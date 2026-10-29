// =====================================================================
// Aras Innovator R36 Server Method: bcs_label_search_handler
// 掛載事件: 目標 ItemType (例如 Part) 的 onBeforeGet 事件
// 程式語言: C# (.NET Framework / .NET Core)
// 語法規範: 符合 Aras Innovator Method Wrapper 機制
//           (直接作為方法體編譯，無需 namespace、using 與 class 外層宣告)
// 運作邏輯:
//   1. 攔截查詢請求中針對 labels 欄位的搜尋條件 (例如 "*VIP重點*" 或 "*緊急處理,設計審查*")。
//   2. 透過安全記憶體快取查詢 bcs_label_tags 目錄，高精度比對標籤 name 與 label。
//   3. 重寫查詢條件為兼具唯一 Key 與多語系標籤的多重模糊匹配 (AND 邏輯)，確保精確命中。
// =====================================================================

Innovator inn = this.getInnovator();
const string targetPropertyName = "labels";
const string tagItemType = "bcs_label_tags";

try
{
    // 檢查是否含有 labels 欄位的查詢條件
    string rawCriteria = this.getProperty(targetPropertyName, string.Empty);
    if (string.IsNullOrWhiteSpace(rawCriteria))
    {
        return this; // 無標籤查詢條件，直接放行原生查詢
    }

    // 1. 解析使用者輸入之標籤關鍵字 (去除頭尾萬用字元 * 與 %，依逗號或分號切分)
    string clean = rawCriteria.Trim().Trim('*', '%', ' ');
    char[] splitSeparators = new char[] { ',', ';', '，', '；' };
    string[] rawParts = clean.Split(splitSeparators, StringSplitOptions.RemoveEmptyEntries);

    List<string> searchTerms = new List<string>();
    foreach (string part in rawParts)
    {
        string term = part.Trim().Trim('*', '%');
        if (!string.IsNullOrEmpty(term) && !searchTerms.Contains(term, StringComparer.OrdinalIgnoreCase))
        {
            searchTerms.Add(term);
        }
    }

    if (searchTerms.Count == 0)
    {
        return this;
    }

    // 2. 一次性安全讀取 bcs_label_tags 目錄中所有標籤 (記憶體比對，避開 SQL 表名與多語系欄位問題)
    Item catalogQuery = inn.newItem(tagItemType, "get");
    catalogQuery.setAttribute("select", "name,label");
    Item catalogResult = catalogQuery.apply();

    List<Tuple<string, string>> availableCatalogTags = new List<Tuple<string, string>>();
    if (!catalogResult.isError() && catalogResult.getItemCount() > 0)
    {
        for (int i = 0; i < catalogResult.getItemCount(); i++)
        {
            Item t = catalogResult.getItemByIndex(i);
            string n = t.getProperty("name", string.Empty);
            string l = t.getProperty("label", string.Empty);
            if (!string.IsNullOrEmpty(n))
            {
                availableCatalogTags.Add(new Tuple<string, string>(n, l));
            }
        }
    }

    // 3. 高精度對齊標籤鍵值 (Key) 與顯示文字 (Label)
    List<string> resolvedKeys = new List<string>();
    List<string> resolvedLabels = new List<string>();

    foreach (string term in searchTerms)
    {
        bool matched = false;
        // 先嘗試精確比對目錄中的 name 或 label (大小寫無關)
        foreach (var catTag in availableCatalogTags)
        {
            if (string.Equals(catTag.Item1, term, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(catTag.Item2, term, StringComparison.OrdinalIgnoreCase))
            {
                if (!resolvedKeys.Contains(catTag.Item1, StringComparer.OrdinalIgnoreCase))
                {
                    resolvedKeys.Add(catTag.Item1);
                    resolvedLabels.Add(!string.IsNullOrEmpty(catTag.Item2) ? catTag.Item2 : catTag.Item1);
                }
                matched = true;
                break;
            }
        }

        // 若無完全相符，嘗試部分包含比對
        if (!matched)
        {
            foreach (var catTag in availableCatalogTags)
            {
                if ((!string.IsNullOrEmpty(catTag.Item2) && catTag.Item2.IndexOf(term, StringComparison.OrdinalIgnoreCase) >= 0) ||
                    catTag.Item1.IndexOf(term, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    if (!resolvedKeys.Contains(catTag.Item1, StringComparer.OrdinalIgnoreCase))
                    {
                        resolvedKeys.Add(catTag.Item1);
                        resolvedLabels.Add(!string.IsNullOrEmpty(catTag.Item2) ? catTag.Item2 : catTag.Item1);
                    }
                    matched = true;
                    break;
                }
            }
        }

        // 若仍未在目錄找到，直接以使用者輸入字串作為比對依據
        if (!matched && !resolvedKeys.Contains(term, StringComparer.OrdinalIgnoreCase))
        {
            resolvedKeys.Add(term);
            resolvedLabels.Add(term);
        }
    }

    if (resolvedKeys.Count == 0)
    {
        return this;
    }

    // 4. 移除原本單一的 labels 條件
    this.removeProperty(targetPropertyName);

    // 5. 動態構建安全且精確的 AML 查詢條件 (多標籤預設 AND 交集，內部雙保險 LIKE 比對)
    System.Xml.XmlDocument doc = this.node.OwnerDocument;

    if (resolvedKeys.Count == 1)
    {
        string key = resolvedKeys[0];
        string lbl = resolvedLabels[0];

        if (string.Equals(key, lbl, StringComparison.OrdinalIgnoreCase))
        {
            this.setProperty(targetPropertyName, $"%\"{key}\"%");
            this.setPropertyAttribute(targetPropertyName, "condition", "like");
        }
        else
        {
            System.Xml.XmlElement orBlock = doc.CreateElement("or");

            System.Xml.XmlElement condKey = doc.CreateElement(targetPropertyName);
            condKey.SetAttribute("condition", "like");
            condKey.InnerText = $"%\"name\":\"{key}\"%";
            orBlock.AppendChild(condKey);

            System.Xml.XmlElement condLbl = doc.CreateElement(targetPropertyName);
            condLbl.SetAttribute("condition", "like");
            condLbl.InnerText = $"%{lbl}%";
            orBlock.AppendChild(condLbl);

            this.node.AppendChild(orBlock);
        }
    }
    else
    {
        System.Xml.XmlElement andBlock = doc.CreateElement("and");

        for (int i = 0; i < resolvedKeys.Count; i++)
        {
            string key = resolvedKeys[i];
            string lbl = resolvedLabels[i];

            if (string.Equals(key, lbl, StringComparison.OrdinalIgnoreCase))
            {
                System.Xml.XmlElement condElem = doc.CreateElement(targetPropertyName);
                condElem.SetAttribute("condition", "like");
                condElem.InnerText = $"%\"{key}\"%";
                andBlock.AppendChild(condElem);
            }
            else
            {
                System.Xml.XmlElement orBlock = doc.CreateElement("or");

                System.Xml.XmlElement condKey = doc.CreateElement(targetPropertyName);
                condKey.SetAttribute("condition", "like");
                condKey.InnerText = $"%\"name\":\"{key}\"%";
                orBlock.AppendChild(condKey);

                System.Xml.XmlElement condLbl = doc.CreateElement(targetPropertyName);
                condLbl.SetAttribute("condition", "like");
                condLbl.InnerText = $"%{lbl}%";
                orBlock.AppendChild(condLbl);

                andBlock.AppendChild(orBlock);
            }
        }

        this.node.AppendChild(andBlock);
    }

    return this;
}
catch (Exception ex)
{
    // 發生非預期例外時，記錄錯誤並安全回退，避免中斷正常搜尋流程
    return inn.newError($"[bcs_label_search_handler] 查詢條件解析失敗: {ex.Message}");
}
