/**
 * @file LabelTag.js
 * @description 標籤實體類別，封裝單一標籤的屬性定義、多語系支援、色彩驗證、文字對比色計算與序列化邏輯。
 * 符合物件導向之單一職責原則 (SRP)。採用 UMD 模式封裝相容 Node.js 與瀏覽器。
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.LabelTag = factory();
  }
})(typeof window !== "undefined" ? window : global, function () {
  class LabelTag {
    /**
     * 建構子：初始化標籤物件
     * @param {string} name - 標籤鍵值代碼 (Key/ID，長度限制 32 字元)
     * @param {string} label - 標籤介面預設顯示名稱 (長度限制 64 字元)
     * @param {string} [color="#3B82F6"] - 十六進制色彩碼 (例如 #EF4444)
     * @param {number} [sort_id=0] - 排序序號 (float)
     * @param {Object} [labels={}] - 多語系字典 (例如 { "zh-TW": "緊急", "en": "Urgent" })
     */
    constructor(name, label, color = "#3B82F6", sort_id = 0, labels = {}) {
      if (!name || typeof name !== "string") {
        throw new Error("LabelTag 必須具備有效的 name 字串鍵值。");
      }

      /** @type {string} 標籤唯一鍵值代碼 (不隨語系變動) */
      this.name = name.trim();

      /** @type {string} 預設介面顯示名稱 */
      this.label = label && typeof label === "string" ? label.trim() : this.name;

      /** @type {string} 標籤顏色 (#RRGGBB) */
      this.color = LabelTag.normalizeColor(color);

      /** @type {number} 排序序號 */
      this.sort_id = typeof sort_id === "number" ? sort_id : parseFloat(sort_id) || 0;

      /** @type {Object<string, string>} 多語系顯示名稱字典 */
      this.labels = labels && typeof labels === "object" ? { ...labels } : {};

      // 若未在 labels 字典中指定，自動將預設 label 存入
      if (!this.labels["default"] && this.label) {
        this.labels["default"] = this.label;
      }
    }

    /**
     * 格式化並校驗十六進制顏色
     * @param {string} rawColor - 原始顏色字串
     * @returns {string} 標準化之十六進制色彩碼
     */
    static normalizeColor(rawColor) {
      if (!rawColor || typeof rawColor !== "string") {
        return "#3B82F6"; // 預設柔和藍色
      }
      const clean = rawColor.trim();
      const hexRegex = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;
      if (hexRegex.test(clean)) {
        if (clean.length === 4) {
          return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`.toUpperCase();
        }
        return clean.toUpperCase();
      }
      return "#3B82F6";
    }

    /**
     * 依據指定的語系代碼取得最符合的顯示標籤文字 (支援優雅退回 Fallback)
     * 優先序：當前語系代碼 (zh-TW) -> 基礎語言代碼 (zh) -> 預設 label -> 英文 (en) -> 鍵值名稱 (name)
     * @param {string} [langCode="zh-TW"] - 使用者目前的語系代碼 (例如 "zh-TW", "en", "zh-CN")
     * @param {string} [fallbackLang="en"] - 備用語系代碼
     * @returns {string} 該語系下適當的顯示文字
     */
    getDisplayLabel(langCode = "zh-TW", fallbackLang = "en") {
      if (this.labels && typeof this.labels === "object") {
        // 1. 完全符合目標語系 (例如 "zh-TW")
        if (this.labels[langCode] && typeof this.labels[langCode] === "string" && this.labels[langCode].trim()) {
          return this.labels[langCode].trim();
        }

        // 2. 匹配基礎語言代碼 (例如 "zh-TW" 匹配 "zh")
        const baseLang = langCode.split("-")[0];
        if (this.labels[baseLang] && typeof this.labels[baseLang] === "string" && this.labels[baseLang].trim()) {
          return this.labels[baseLang].trim();
        }

        // 3. 退回至 fallbackLang (例如 "en")
        if (this.labels[fallbackLang] && typeof this.labels[fallbackLang] === "string" && this.labels[fallbackLang].trim()) {
          return this.labels[fallbackLang].trim();
        }

        // 4. 字典中的預設文字
        if (this.labels["default"] && typeof this.labels["default"] === "string" && this.labels["default"].trim()) {
          return this.labels["default"].trim();
        }
      }

      // 5. 物件本身定義的 label 或 name
      return this.label || this.name;
    }

    /**
     * 設定特定語系的顯示名稱
     * @param {string} langCode - 語系代碼 (如 "zh-TW")
     * @param {string} labelText - 該語系的顯示文字
     */
    setLanguageLabel(langCode, labelText) {
      if (langCode && typeof langCode === "string" && labelText) {
        this.labels[langCode.trim()] = labelText.trim();
      }
    }

    /**
     * 計算並返回此背景顏色下的最佳對比文字顏色 (深色或淺色)
     * 依據 W3C YIQ 亮度公式計算：(r*299 + g*587 + b*114) / 1000
     * @returns {string} 高對比文字色 ("#1F2937" 或 "#FFFFFF")
     */
    getContrastTextColor() {
      const hex = this.color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 150 ? "#1F2937" : "#FFFFFF";
    }

    /**
     * 輸出可被 JSON 序列化的標準純物件，包含完整多語系映射
     * @returns {Object} 標籤純物件
     */
    toJSON() {
      return {
        name: this.name,
        label: this.label,
        labels: this.labels,
        color: this.color,
        sort_id: this.sort_id
      };
    }

    /**
     * 從純物件還原為 LabelTag 實體
     * @param {Object} obj - 包含 name, label, labels, color, sort_id 的純物件
     * @returns {LabelTag}
     */
    static fromJSON(obj) {
      if (!obj || typeof obj !== "object") {
        throw new Error("無效的 Label 物件資料。");
      }
      return new LabelTag(obj.name, obj.label, obj.color, obj.sort_id, obj.labels);
    }
  }

  return LabelTag;
});
