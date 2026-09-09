/**
 * @file IArasAdapter.js
 * @description Aras 適配器介面定義 (遵循 DIP 與 ISP 原則)，採用 UMD 模式封裝。
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.IArasAdapter = factory();
  }
})(typeof window !== "undefined" ? window : global, function () {
  class IArasAdapter {
    /**
     * 取得使用者目前登入的語系代碼 (例如 "zh-TW", "en", "zh-CN")
     * @returns {string}
     */
    getCurrentLanguage() {
      throw new Error("方法未實作：getCurrentLanguage");
    }

    /**
     * 取得目標 Item 屬性值
     * @param {string} propertyName - 屬性名稱
     * @returns {string}
     */
    getPropertyValue(propertyName) {
      throw new Error("方法未實作：getPropertyValue");
    }

    /**
     * 設定目標 Item 屬性值並通知 Aras 表單變更 (Dirty)
     * @param {string} propertyName - 屬性名稱
     * @param {string} value - 屬性新值 (JSON 字串)
     */
    setPropertyValue(propertyName, value) {
      throw new Error("方法未實作：setPropertyValue");
    }

    /**
     * 判斷當前表單是否處於可編輯狀態 (Edit Mode)
     * @returns {boolean}
     */
    isEditMode() {
      throw new Error("方法未實作：isEditMode");
    }

    /**
     * 查詢 bcs_label 及其關聯的 bcs_label_tags 可用標籤清單
     * @param {string} categoryName - 標籤分類目錄名稱
     * @returns {Promise<Array<LabelTag>>}
     */
    async fetchAvailableTags(categoryName) {
      throw new Error("方法未實作：fetchAvailableTags");
    }
  }

  return IArasAdapter;
});
