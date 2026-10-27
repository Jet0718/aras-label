// =====================================================================
// Aras Innovator R36 Server Method: bcs_label_search_handler
// 掛載事件: 目標 ItemType (例如 Part) 的 onBeforeGet 事件
// 程式語言: C# (.NET Framework / .NET Core)
// 語法規範: 符合 Aras Innovator Method Wrapper 機制
//           (直接作為方法體編譯，無需 namespace、using 與 class 外層宣告)
// 運作邏輯:
//   1. 攔截查詢請求中針對 labels 欄位的搜尋條件 (例如 "*緊急處理*" 或 "*urgent,vip*")。
//   2. 透過 IOM 查詢 bcs_label_tags，將使用者輸入的中文/多語系標籤轉換為標準鍵值 Key (name)。
//   3. 重寫查詢條件為符合 AND 邏輯的高效 JSON 子字串模糊匹配 (%"name":"urgent"%)。
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
        return this; // 無標籤查詢條件，直接放行
    }

    // 1. 解析使用者輸入之多個標籤關鍵字 (支援逗號或分號分隔，去除頭尾萬用字元)
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

    // 2. 查詢 bcs_label_tags 目錄，比對 name 或各語系 label，對齊標籤唯一鍵值 (name)
    List<string> resolvedTagKeys = new List<string>();

    foreach (string term in searchTerms)
    {
        // 簡易過濾單引號防範 AML/SQL 注入
        string safeTerm = term.Replace("'", "''");

        Item tagQuery = inn.newItem(tagItemType, "get");
        tagQuery.setAttribute("select", "name,label");
        tagQuery.setAttribute("where", $"[bcs_label_tags].name = '{safeTerm}' OR [bcs_label_tags].label LIKE N'%{safeTerm}%'");

        Item result = tagQuery.apply();
        if (!result.isError() && result.getItemCount() > 0)
        {
            for (int i = 0; i < result.getItemCount(); i++)
            {
                Item tag = result.getItemByIndex(i);
                string key = tag.getProperty("name", string.Empty);
                if (!string.IsNullOrEmpty(key) && !resolvedTagKeys.Contains(key, StringComparer.OrdinalIgnoreCase))
                {
                    resolvedTagKeys.Add(key);
                }
            }
        }
        else
        {
            // 若在標籤目錄查無完全匹配定義，直接以使用者輸入字串作為 key 比對
            if (!resolvedTagKeys.Contains(term, StringComparer.OrdinalIgnoreCase))
            {
                resolvedTagKeys.Add(term);
            }
        }
    }

    if (resolvedTagKeys.Count == 0)
    {
        return this;
    }

    // 3. 移除原本單一的 labels 條件
    this.removeProperty(targetPropertyName);

    if (resolvedTagKeys.Count == 1)
    {
        // 單一條件：%"name":"urgent"%
        this.setProperty(targetPropertyName, $"%\"name\":\"{resolvedTagKeys[0]}\"%");
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

        foreach (string key in resolvedTagKeys)
        {
            System.Xml.XmlElement condElem = doc.CreateElement(targetPropertyName);
            condElem.SetAttribute("condition", "like");
            condElem.InnerText = $"%\"name\":\"{key}\"%";
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
