/**
 * @file bcs_label_search_handler.cs
 * @description Aras Innovator R36 伺服器端搜尋轉譯方法 (Server Method)
 * 掛載事件: Target ItemType (例如 Part) 的 onBeforeGet 事件
 * 程式語言: C# (.NET Framework / .NET Core)
 * 運作邏輯:
 *   1. 攔截查詢請求中針對 labels 欄位的搜尋條件 (例如 "*緊急處理*" 或 "*urgent,vip*")。
 *   2. 透過 IOM 查詢 bcs_label_tags，將使用者輸入的中文/多語系標籤轉換為標準鍵值 Key (name)。
 *   3. 重寫查詢條件為符合 AND 邏輯的高效 JSON 子字串模糊匹配 (%"name":"urgent"%)。
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Aras.IOM;

namespace Bcs.Innovator.Server.Search
{
    /// <summary>
    /// 多標籤模糊搜尋伺服器端轉譯器
    /// 遵循單一職責原則 (SRP)
    /// </summary>
    public class BcsLabelSearchHandler
    {
        private readonly Innovator _inn;
        private readonly Item _queryItem;
        private const string TargetPropertyName = "labels";
        private const string TagItemType = "bcs_label_tags";

        /// <summary>
        /// 建構子：初始化搜尋轉譯器實體
        /// </summary>
        /// <param name="queryItem">當前進入 onBeforeGet 之 Item 實體</param>
        public BcsLabelSearchHandler(Item queryItem)
        {
            _queryItem = queryItem ?? throw new ArgumentNullException(nameof(queryItem));
            _inn = queryItem.getInnovator();
        }

        /// <summary>
        /// 執行查詢條件轉譯處理入口
        /// </summary>
        /// <returns>處理完成之 Item</returns>
        public Item Process()
        {
            try
            {
                // 檢查是否含有 labels 欄位的查詢條件
                string rawCriteria = _queryItem.getProperty(TargetPropertyName, string.Empty);
                string condition = _queryItem.getPropertyAttribute(TargetPropertyName, "condition", "like");

                if (string.IsNullOrWhiteSpace(rawCriteria))
                {
                    return _queryItem; // 無標籤查詢條件，直接放行
                }

                // 1. 解析使用者輸入之多個標籤關鍵字 (支援逗號或分號分隔，去除萬用字元)
                List<string> searchTerms = ExtractSearchTerms(rawCriteria);
                if (searchTerms.Count == 0)
                {
                    return _queryItem;
                }

                // 2. 查詢 bcs_label_tags 目錄，對齊標籤唯一鍵值 (name)
                List<string> resolvedTagKeys = ResolveTagKeys(searchTerms);

                // 3. 重構 AML 查詢條件 (依據使用者確認需求，預設採用 AND 邏輯)
                ApplyAndCriteria(resolvedTagKeys);

                return _queryItem;
            }
            catch (Exception ex)
            {
                // 發生非預期例外時，記錄日誌並安全回退，避免中斷正常搜尋流程
                return _inn.newError($"[bcs_label_search_handler] 查詢條件解析失敗: {ex.Message}");
            }
        }

        /// <summary>
        /// 解析使用者輸入的字串為標籤關鍵字清單
        /// </summary>
        /// <param name="rawInput">原始輸入 (例如 "*緊急處理,VIP重點*")</param>
        /// <returns>清理後的關鍵字集合</returns>
        private List<string> ExtractSearchTerms(string rawInput)
        {
            var terms = new List<string>();
            if (string.IsNullOrWhiteSpace(rawInput)) return terms;

            // 去除頭尾萬用字元 * 與 %
            string clean = rawInput.Trim().Trim('*', '%', ' ');

            // 支援以逗號、分號或空白切分
            string[] parts = clean.Split(new[] { ',', ';', '，', '；' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var part in parts)
            {
                string t = part.Trim().Trim('*', '%');
                if (!string.IsNullOrEmpty(t) && !terms.Contains(t, StringComparer.OrdinalIgnoreCase))
                {
                    terms.Add(t);
                }
            }
            return terms;
        }

        /// <summary>
        /// 將使用者輸入的文字 (可能是 name 或各語系 label) 比對轉換為 bcs_label_tags 的唯一 name (Key)
        /// </summary>
        /// <param name="terms">搜尋字串清單</param>
        /// <returns>解析出的唯一標籤 Key 清單</returns>
        private List<string> ResolveTagKeys(List<string> terms)
        {
            var resolvedKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var term in terms)
            {
                // 查詢 bcs_label_tags 表中符合 name 或 label 的項目
                Item tagQuery = _inn.newIOMItem(TagItemType, "get");
                tagQuery.setAttribute("select", "name,label");

                // 構建 OR 條件比對 name 或 label
                string escapedTerm = Regex.Replace(term, @"['\\]", ""); // 防範特殊字元
                tagQuery.setAttribute("where", $"[bcs_label_tags].name = '{escapedTerm}' OR [bcs_label_tags].label LIKE N'%{escapedTerm}%'");

                Item result = tagQuery.apply();
                if (!result.isError() && result.getItemCount() > 0)
                {
                    for (int i = 0; i < result.getItemCount(); i++)
                    {
                        Item item = result.getItemByIndex(i);
                        string key = item.getProperty("name", string.Empty);
                        if (!string.IsNullOrEmpty(key))
                        {
                            resolvedKeys.Add(key);
                        }
                    }
                }
                else
                {
                    // 若在目錄查無定義，則直接將輸入關鍵字作為 key 或子字串匹配
                    resolvedKeys.Add(term);
                }
            }

            return resolvedKeys.ToList();
        }

        /// <summary>
        /// 將查詢條件套用為 AND (交集) 邏輯的 JSON 子字串模糊匹配
        /// </summary>
        /// <param name="tagKeys">標籤代碼清單</param>
        private void ApplyAndCriteria(List<string> tagKeys)
        {
            if (tagKeys.Count == 0) return;

            // 移除原本單一的 labels 條件
            _queryItem.removeProperty(TargetPropertyName);

            if (tagKeys.Count == 1)
            {
                // 單一條件：%"name":"urgent"%
                string pattern = $"%\"name\":\"{tagKeys[0]}\"%";
                _queryItem.setProperty(TargetPropertyName, pattern);
                _queryItem.setPropertyAttribute(TargetPropertyName, "condition", "like");
            }
            else
            {
                // 多標籤 AND 條件：透過 AML 的 <and> 區塊展開
                // <and>
                //   <labels condition="like">%"name":"urgent"%</labels>
                //   <labels condition="like">%"name":"vip"%</labels>
                // </and>
                Item andBlock = _inn.newIOMItem(string.Empty, string.Empty);
                andBlock.node = _queryItem.node.OwnerDocument.CreateElement("and");

                foreach (var key in tagKeys)
                {
                    string pattern = $"%\"name\":\"{key}\"%";
                    var condElem = _queryItem.node.OwnerDocument.CreateElement(TargetPropertyName);
                    condElem.SetAttribute("condition", "like");
                    condElem.InnerText = pattern;
                    andBlock.node.AppendChild(condElem);
                }

                _queryItem.node.AppendChild(andBlock.node);
            }
        }
    }
}

// Aras Method 入口標準主體
// Innovator Server 執行時將傳入 this (Item 物件)
/*
Innovator inn = this.getInnovator();
var handler = new Bcs.Innovator.Server.Search.BcsLabelSearchHandler(this);
return handler.Process();
*/
