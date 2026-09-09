/**
 * @file MockArasAdapter.js
 * @description 模擬 Aras Innovator Web Client 行為之本機適配器，採用 UMD 模式封裝。
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./IArasAdapter"), require("../models/LabelTag"));
  } else {
    root.MockArasAdapter = factory(root.IArasAdapter, root.LabelTag);
  }
})(typeof window !== "undefined" ? window : global, function (IArasAdapter, LabelTag) {
  class MockArasAdapter extends IArasAdapter {
    /**
     * 建構子：初始化模擬資料
     * @param {Object} [options={}] - 初始化選項
     */
    constructor(options = {}) {
      super();
      /** @type {string} 目前使用者語系 */
      this.currentLanguage = options.currentLanguage || "zh-TW";

      /** @type {boolean} 是否為編輯模式 */
      this.editMode = options.editMode !== undefined ? options.editMode : true;

      /** @type {Map<string, string>} 模擬目標 Item 屬性鍵值庫 */
      this.properties = new Map();

      /** @type {Array<LabelTag>} 模擬之 bcs_label_tags 候選標籤 */
      this.mockTags = options.mockTags || [
        new LabelTag("urgent", "緊急處理", "#EF4444", 10, {
          "zh-TW": "緊急處理",
          "zh-CN": "紧急处理",
          "en": "Urgent Action"
        }),
        new LabelTag("vip", "VIP客戶", "#8B5CF6", 20, {
          "zh-TW": "VIP客戶",
          "zh-CN": "VIP客户",
          "en": "VIP Customer"
        }),
        new LabelTag("design", "設計階段", "#3B82F6", 30, {
          "zh-TW": "設計階段",
          "zh-CN": "设计阶段",
          "en": "Design Stage"
        }),
        new LabelTag("review", "覆核審查", "#10B981", 40, {
          "zh-TW": "覆核審查",
          "zh-CN": "复核审查",
          "en": "In Review"
        }),
        new LabelTag("hold", "暫緩作業", "#F59E0B", 50, {
          "zh-TW": "暫緩作業",
          "zh-CN": "暂缓作业",
          "en": "On Hold"
        })
      ];

      /** @type {Function|null} 屬性值變更外部監聽回調 */
      this.onPropertyChangeCallback = options.onPropertyChangeCallback || null;
    }

    getCurrentLanguage() {
      return this.currentLanguage;
    }

    setLanguage(langCode) {
      this.currentLanguage = langCode;
    }

    getPropertyValue(propertyName) {
      return this.properties.get(propertyName) || "";
    }

    setPropertyValue(propertyName, value) {
      this.properties.set(propertyName, value);
      if (typeof this.onPropertyChangeCallback === "function") {
        this.onPropertyChangeCallback(propertyName, value);
      }
    }

    isEditMode() {
      return this.editMode;
    }

    setEditMode(isEditable) {
      this.editMode = Boolean(isEditable);
    }

    async fetchAvailableTags(categoryName) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve([...this.mockTags]);
        }, 30);
      });
    }
  }

  return MockArasAdapter;
});
