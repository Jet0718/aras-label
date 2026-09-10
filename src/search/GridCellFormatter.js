/**
 * @file GridCellFormatter.js
 * @description Aras Innovator Grid 列表單元格渲染器，將文字欄位的 JSON 陣列自動格式化為彩色標籤徽章 (Chips)。
 * 採用 UMD 模式封裝。
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../models/LabelTag"));
  } else {
    root.GridCellFormatter = factory(root.LabelTag);
  }
})(typeof window !== "undefined" ? window : global, function (LabelTag) {
  class GridCellFormatter {
    /**
     * 將原始 JSON 字串格式化為包含彩色 Badge 的 HTML 片段
     * @param {string} rawJson - 儲存於文字欄位之 JSON 陣列字串
     * @param {string} [langCode="zh-TW"] - 當前顯示語系代碼
     * @returns {string} 格式化後的 HTML 字串
     */
    static formatToHTML(rawJson, langCode = "zh-TW") {
      if (!rawJson || typeof rawJson !== "string") {
        return "";
      }

      let tags = [];
      try {
        const parsed = JSON.parse(rawJson.trim());
        if (Array.isArray(parsed)) {
          tags = parsed.map((item) => (item instanceof LabelTag ? item : LabelTag.fromJSON(item)));
        }
      } catch {
        // 若為舊資料或非標準 JSON，直接安全轉義顯示原始文字
        return `<span class="bcs-grid-raw-text">${GridCellFormatter.escapeHTML(rawJson)}</span>`;
      }

      if (tags.length === 0) return "";

      const badgesHtml = tags
        .map((tag) => {
          const displayLabel = tag.getDisplayLabel(langCode);
          const textColor = tag.getContrastTextColor();
          return `<span class="bcs-grid-tag-badge" style="background-color: ${tag.color}; color: ${textColor};" title="${GridCellFormatter.escapeHTML(tag.name)}">${GridCellFormatter.escapeHTML(displayLabel)}</span>`;
        })
        .join("");

      return `<div class="bcs-grid-tags-cell">${badgesHtml}</div>`;
    }

    /**
     * 轉義 HTML 特殊字元防範 XSS
     * @param {string} str
     * @returns {string}
     */
    static escapeHTML(str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  }

  return GridCellFormatter;
});
