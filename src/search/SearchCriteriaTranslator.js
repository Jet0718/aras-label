/**
 * @file SearchCriteriaTranslator.js
 * @description 搜尋條件轉譯器，負責解析使用者輸入之標籤條件，轉譯為符合 AND / OR 邏輯之標準模糊匹配運算式。
 * 遵循單一職責原則 (SRP)，採用 UMD 模式相容 Node.js 與瀏覽器。
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SearchCriteriaTranslator = factory();
  }
})(typeof window !== "undefined" ? window : global, function () {
  class SearchCriteriaTranslator {
    /**
     * 解析使用者輸入之多標籤搜尋文字為獨立關鍵字清單
     * @param {string} rawInput - 原始字串 (如 "*緊急處理, VIP重點*" 或 "urgent;vip")
     * @returns {Array<string>} 清理後之關鍵字陣列
     */
    static parseTerms(rawInput) {
      if (!rawInput || typeof rawInput !== "string") return [];

      // 移除萬用字元與頭尾空白
      const clean = rawInput.trim().replace(/^[*%]+|[*%]+$/g, "");
      if (!clean) return [];

      // 依逗號、分號或全形逗號分開
      const splitted = clean.split(/[,;，；]/);
      const results = [];

      splitted.forEach((part) => {
        const item = part.trim().replace(/^[*%]+|[*%]+$/g, "");
        if (item && !results.includes(item)) {
          results.push(item);
        }
      });

      return results;
    }

    /**
     * 依據標籤代碼 (Key) 生成 JSON 子字串模糊匹配樣板
     * @param {string} tagKey - 標籤代碼 (例如 "urgent")
     * @returns {string} 模糊匹配樣板 (例如 '%"name":"urgent"%')
     */
    static buildJsonLikePattern(tagKey) {
      const cleanKey = (tagKey || "").trim();
      return `%"name":"${cleanKey}"%`;
    }

    /**
     * 產生多標籤 AML 查詢過濾條件節點字串
     * @param {string} propertyName - 屬性欄位名 (如 "labels")
     * @param {Array<string>} tagKeys - 標籤代碼清單
     * @param {string} [mode="AND"] - 運算模式 ("AND" 或 "OR")
     * @returns {string} AML XML 片段
     */
    static buildAML(propertyName, tagKeys, mode = "AND") {
      if (!tagKeys || tagKeys.length === 0) return "";

      if (tagKeys.length === 1) {
        const pat = SearchCriteriaTranslator.buildJsonLikePattern(tagKeys[0]);
        return `<${propertyName} condition="like">${pat}</${propertyName}>`;
      }

      const wrapperTag = mode.toUpperCase() === "OR" ? "or" : "and";
      const conditions = tagKeys
        .map((key) => {
          const pat = SearchCriteriaTranslator.buildJsonLikePattern(key);
          return `  <${propertyName} condition="like">${pat}</${propertyName}>`;
        })
        .join("\n");

      return `<${wrapperTag}>\n${conditions}\n</${wrapperTag}>`;
    }

    /**
     * 本機記憶體模擬過濾：判斷特定項目的 JSON 欄位是否符合搜尋條件
     * @param {string} storedJson - 目標欄位儲存的 JSON 陣列字串
     * @param {Array<string>} searchTerms - 搜尋項目 (可為 name 或各語系 label)
     * @param {string} [mode="AND"] - "AND" 或 "OR"
     * @returns {boolean} 是否符合搜尋條件
     */
    static matchesRecord(storedJson, searchTerms, mode = "AND") {
      if (!searchTerms || searchTerms.length === 0) return true;
      if (!storedJson || typeof storedJson !== "string") return false;

      let storedTags = [];
      try {
        storedTags = JSON.parse(storedJson);
        if (!Array.isArray(storedTags)) return false;
      } catch {
        return false;
      }

      const matchSingleTerm = (term) => {
        const lowerTerm = term.toLowerCase().trim();
        return storedTags.some((tag) => {
          if (!tag) return false;
          // 比對 name
          if (tag.name && tag.name.toLowerCase() === lowerTerm) return true;
          // 比對預設 label
          if (tag.label && tag.label.toLowerCase().includes(lowerTerm)) return true;
          // 比對多語系 labels
          if (tag.labels && typeof tag.labels === "object") {
            return Object.values(tag.labels).some(
              (val) => typeof val === "string" && val.toLowerCase().includes(lowerTerm)
            );
          }
          return false;
        });
      };

      if (mode.toUpperCase() === "OR") {
        return searchTerms.some((term) => matchSingleTerm(term));
      } else {
        // 預設 AND 邏輯
        return searchTerms.every((term) => matchSingleTerm(term));
      }
    }
  }

  return SearchCriteriaTranslator;
});
