/**
 * @file LabelStore.js
 * @description 標籤狀態管理類別，負責記憶體中已選標籤的增刪、去重、排序與 JSON 序列化/反序列化。
 * 符合單一職責原則 (SRP)，採用 UMD 模組模式封裝相容 Node.js 與瀏覽器。
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../models/LabelTag"));
  } else {
    root.LabelStore = factory(root.LabelTag);
  }
})(typeof window !== "undefined" ? window : global, function (LabelTag) {
  class LabelStore {
    /**
     * 建構子：初始化標籤存儲器
     * @param {Array<LabelTag>} [initialTags=[]] - 初始標籤清單
     */
    constructor(initialTags = []) {
      /** @type {Array<LabelTag>} 已選擇的標籤陣列 */
      this.tags = [];

      if (Array.isArray(initialTags)) {
        initialTags.forEach((t) => this.add(t));
      }
    }

    /**
     * 檢查指定 name 的標籤是否已存在
     * @param {string} name - 標籤鍵值代碼
     * @returns {boolean}
     */
    has(name) {
      if (!name || typeof name !== "string") return false;
      const target = name.trim().toLowerCase();
      return this.tags.some((t) => t.name.toLowerCase() === target);
    }

    /**
     * 新增標籤至集合（若已存在相同 name 則不重複新增）
     * @param {LabelTag|Object} tag - 欲加入之標籤物件
     * @returns {boolean} true 表示新增成功；false 表示已存在或無效
     */
    add(tag) {
      if (!tag) return false;
      const tagEntity = tag instanceof LabelTag ? tag : LabelTag.fromJSON(tag);

      if (this.has(tagEntity.name)) {
        return false;
      }

      this.tags.push(tagEntity);
      this.sort();
      return true;
    }

    /**
     * 依據 name 鍵值移除標籤
     * @param {string} name - 標籤鍵值代碼
     * @returns {boolean} true 表示成功移除；false 表示未找到
     */
    removeByName(name) {
      if (!name || typeof name !== "string") return false;
      const target = name.trim().toLowerCase();
      const initialLen = this.tags.length;
      this.tags = this.tags.filter((t) => t.name.toLowerCase() !== target);
      return this.tags.length < initialLen;
    }

    /**
     * 依索引位置移除標籤
     * @param {number} index - 陣列索引
     * @returns {boolean}
     */
    removeAt(index) {
      if (index < 0 || index >= this.tags.length) return false;
      this.tags.splice(index, 1);
      return true;
    }

    /**
     * 清空所有標籤
     */
    clear() {
      this.tags = [];
    }

    /**
     * 依照 sort_id 排序標籤清單
     */
    sort() {
      this.tags.sort((a, b) => a.sort_id - b.sort_id);
    }

    /**
     * 取得所有已選標籤之複本
     * @returns {Array<LabelTag>}
     */
    getAll() {
      return [...this.tags];
    }

    /**
     * 將現有標籤序列化為 JSON 陣列字串
     * @returns {string} JSON 格式字串
     */
    serializeJSON() {
      return JSON.stringify(this.tags.map((t) => t.toJSON()));
    }

    /**
     * 從 JSON 字串反序列化並載入標籤
     * @param {string} jsonString - 原始 JSON 字串
     */
    deserializeJSON(jsonString) {
      this.clear();
      if (!jsonString || typeof jsonString !== "string") {
        return;
      }

      try {
        const parsed = JSON.parse(jsonString.trim());
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && item.name) {
              this.add(LabelTag.fromJSON(item));
            }
          });
        }
      } catch (e) {
        console.warn("LabelStore: 無法解析輸入的 JSON 字串：", e);
        this.tags = [];
      }
    }
  }

  return LabelStore;
});
