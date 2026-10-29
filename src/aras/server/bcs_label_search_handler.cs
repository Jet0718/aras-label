// =====================================================================
// Aras Innovator R36 Server Method: bcs_label_search_handler
// 掛載事件: 目標 ItemType (例如 Part) 的 onBeforeGet 事件
// 程式語言: C# (.NET Framework / .NET Core)
// 語法規範: 符合 Aras Innovator Method Wrapper 機制
//           (直接作為方法體編譯，無需 namespace、using 與 class 外層宣告)
// 運作邏輯:
//   1. 攔截查詢請求中針對 labels 欄位的搜尋條件 (例如 "*VIP重點*" 或 "*緊急處理,設計審查*")。
//   2. 透過安全記憶體快取查詢 bcs_label_tags 目錄 (支援全語系 xml:lang 與雙重查詢防護)。
//   3. 高精度將多語系標籤對齊轉換為唯一鍵值 (name)，轉譯為標準高效之 JSON LIKE 匹配。
// =====================================================================

Innovator inn = this.getInnovator();
const string targetPropertyName = "labels";
const string tagItemType = "bcs_label_tags";
const string parentItemType = "bcs_label";

try
{
    // 檢查是否含有 labels 欄位的查詢條件
    string rawCriteria = this.getProperty(targetPropertyName, string.Empty);
    if (string.IsNullOrWhiteSpace(rawCriteria))
    {
        return this; // 無標籤查詢條件，直接放行原生查詢
    }

    // 1. 解析使用者輸入之標籤關鍵字 (去除頭尾萬用字元 * 與 %，依逗號、分號或空白切分)
    string clean = rawCriteria.Trim().Trim('*', '%', ' ');
    char[] splitSeparators = new char[] { ',', ';', '，', '；', '|' };
    string[] rawParts = clean.Split(splitSeparators, StringSplitOptions.RemoveEmptyEntries);

    List<string> searchTerms = new List<string>();
    foreach (string part in rawParts)
    {
        string term = part.Trim().Trim('*', '%', ' ');
        if (!string.IsNullOrEmpty(term) && !searchTerms.Contains(term, StringComparer.OrdinalIgnoreCase))
        {
            searchTerms.Add(term);
        }
    }

    if (searchTerms.Count == 0)
    {
        return this;
    }

    // 2. 雙重安全讀取 bcs_label_tags 目錄中所有標籤 (記憶體快取比對，避開 SQL 表名與多語系欄位問題)
    // 優先以 bcs_label_tags 直接查詢，並帶入 language="*" 獲取所有語系
    Item catalogQuery = inn.newItem(tagItemType, "get");
    catalogQuery.setAttribute("select", "name,label");
    catalogQuery.setAttribute("language", "*");
    Item catalogResult = catalogQuery.apply();

    // 若直接查詢因權限或關聯約束查無結果，自動透過父表 bcs_label ("Part_Labels") 補查
    if (catalogResult.isError() || catalogResult.getItemCount() == 0)
    {
        Item parentQuery = inn.newItem(parentItemType, "get");
        parentQuery.setAttribute("select", "name");
        parentQuery.setProperty("name", "Part_Labels");
        Item relQuery = inn.newItem(tagItemType, "get");
        relQuery.setAttribute("select", "name,label");
        relQuery.setAttribute("language", "*");
        parentQuery.addRelationship(relQuery);
        Item parentRes = parentQuery.apply();
        if (!parentRes.isError())
        {
            catalogResult = parentRes.getRelationships(tagItemType);
        }
    }

    // 提取所有候選標籤之代碼 (Key) 與所有多語系文字 (Labels)
    List<Tuple<string, string>> availableCatalogTags = new List<Tuple<string, string>>();
    if (!catalogResult.isError() && catalogResult.getItemCount() > 0)
    {
        for (int i = 0; i < catalogResult.getItemCount(); i++)
        {
            Item t = catalogResult.getItemByIndex(i);
            string n = t.getProperty("name", string.Empty);
            if (string.IsNullOrEmpty(n)) continue;

            // 加入代碼自身作為比對
            availableCatalogTags.Add(new Tuple<string, string>(n, n));

            // 加入預設 label
            string defaultLabel = t.getProperty("label", string.Empty);
            if (!string.IsNullOrEmpty(defaultLabel) && !string.Equals(defaultLabel, n, StringComparison.OrdinalIgnoreCase))
            {
                availableCatalogTags.Add(new Tuple<string, string>(n, defaultLabel));
            }

            // 深入 XML 節點取出所有多語系 label 節點 (zh-TW, zh-CN, en 等)
            if (t.node != null)
            {
                System.Xml.XmlNodeList labelNodes = t.node.SelectNodes("label");
                if (labelNodes != null)
                {
                    foreach (System.Xml.XmlNode lblNode in labelNodes)
                    {
                        string txt = (lblNode.InnerText ?? string.Empty).Trim();
                        if (!string.IsNullOrEmpty(txt) && !string.Equals(txt, defaultLabel, StringComparison.OrdinalIgnoreCase))
                        {
                            availableCatalogTags.Add(new Tuple<string, string>(n, txt));
                        }
                    }
                }
            }
        }
    }

    // 3. 高精度對齊標籤鍵值 (Key)，區分目錄鍵值與自訂文字
    List<string> resolvedKeys = new List<string>();
    List<bool> isCatalogKeys = new List<bool>();

    foreach (string term in searchTerms)
    {
        bool matched = false;
        // 優先嘗試精確比對目錄中的 name 或多語系 label (大小寫無關)
        foreach (var catTag in availableCatalogTags)
        {
            if (string.Equals(catTag.Item1, term, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(catTag.Item2, term, StringComparison.OrdinalIgnoreCase))
            {
                if (!resolvedKeys.Contains(catTag.Item1, StringComparer.OrdinalIgnoreCase))
                {
                    resolvedKeys.Add(catTag.Item1);
                    isCatalogKeys.Add(true);
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
                        isCatalogKeys.Add(true);
                    }
                    matched = true;
                    break;
                }
            }
        }

        // 若仍未在目錄找到，直接以使用者輸入字串作為文字匹配依據
        if (!matched && !resolvedKeys.Contains(term, StringComparer.OrdinalIgnoreCase))
        {
            resolvedKeys.Add(term);
            isCatalogKeys.Add(false);
        }
    }

    if (resolvedKeys.Count == 0)
    {
        return this;
    }

    // 4. 移除原本未處理的單一 labels 條件
    this.removeProperty(targetPropertyName);

    // 5. 動態構建安全且精確的 AML 查詢條件 (多標籤預設 AND 交集)
    if (resolvedKeys.Count == 1)
    {
        string key = resolvedKeys[0];
        bool isCatalog = isCatalogKeys[0];

        // 若為目錄標準鍵值，精確匹配 JSON 屬性 %"name":"key"%；若為自訂文字，模糊匹配 %term%
        string pattern = isCatalog ? $"%\"name\":\"{key}\"%" : $"%{key}%";
        this.setProperty(targetPropertyName, pattern);
        this.setPropertyAttribute(targetPropertyName, "condition", "like");
    }
    else
    {
        // 多標籤 AND 條件：透過 AML 的 <and> 區塊展開
        // <and>
        //   <labels condition="like">%"name":"urgent"%</labels>
        //   <labels condition="like">%"name":"vip"%</labels>
        // </and>
        System.Xml.XmlDocument doc = this.node.OwnerDocument;
        System.Xml.XmlElement andBlock = doc.CreateElement("and");

        for (int i = 0; i < resolvedKeys.Count; i++)
        {
            string key = resolvedKeys[i];
            bool isCatalog = isCatalogKeys[i];
            string pattern = isCatalog ? $"%\"name\":\"{key}\"%" : $"%{key}%";

            System.Xml.XmlElement condElem = doc.CreateElement(targetPropertyName);
            condElem.SetAttribute("condition", "like");
            condElem.InnerText = pattern;
            andBlock.AppendChild(condElem);
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
