/**
 * @file ArasAdapter.js
 * @description Aras Innovator R36 平台原生適配器，封裝 Client 端 IOM、Form Event 與 Session 多語系 API。
 * 採用 UMD 模式封裝。
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./IArasAdapter"), require("../models/LabelTag"));
  } else {
    root.ArasAdapter = factory(root.IArasAdapter, root.LabelTag);
  }
})(typeof window !== "undefined" ? window : global, function (IArasAdapter, LabelTag) {
  class ArasAdapter extends IArasAdapter {
    /**
     * 建構子：初始化 Aras 實體環境
     * @param {Object} [arasWindow=window] - 當前 Form 的 Window 實體
     */
    constructor(arasWindow = typeof window !== "undefined" ? window : null) {
      super();
      this.win = arasWindow;
      this.aras = (arasWindow && arasWindow.aras) || (typeof aras !== "undefined" ? aras : null);
    }

    /**
     * 取得使用者目前在 Aras Innovator 的登入語系
     * @returns {string} 語系代碼 (如 "zh-TW", "en", "zh-CN")
     */
    getCurrentLanguage() {
      try {
        if (this.aras) {
          if (typeof this.aras.getSessionContext === "function") {
            const sessionCtx = this.aras.getSessionContext();
            if (sessionCtx && typeof sessionCtx.getLanguageCode === "function") {
              return sessionCtx.getLanguageCode() || "zh-TW";
            }
          }
          if (typeof this.aras.getLanguageCode === "function") {
            return this.aras.getLanguageCode() || "zh-TW";
          }
        }
      } catch (e) {
        console.warn("ArasAdapter: 取得語系代碼失敗，使用預設 zh-TW", e);
      }
      return "zh-TW";
    }

    /**
     * 取得當前 Item 的屬性值
     * @param {string} propertyName - 屬性名稱
     * @returns {string}
     */
    getPropertyValue(propertyName) {
      try {
        const doc = this.win ? this.win.document : null;
        if (doc && doc.item) {
          if (typeof doc.item.getProperty === "function") {
            return doc.item.getProperty(propertyName) || "";
          }
          if (this.aras && typeof this.aras.getItemProperty === "function") {
            return this.aras.getItemProperty(doc.item, propertyName) || "";
          }
        }
      } catch (e) {
        console.warn(`ArasAdapter: 讀取屬性 [${propertyName}] 失敗`, e);
      }
      return "";
    }

    /**
     * 設定屬性值並呼叫 Aras handleItemChange 通知表單與伺服器
     * @param {string} propertyName - 屬性名稱
     * @param {string} value - 屬性新值 (JSON 字串)
     */
    setPropertyValue(propertyName, value) {
      try {
        if (this.win && typeof this.win.handleItemChange === "function") {
          this.win.handleItemChange(propertyName, value);
          return;
        }
        if (this.aras && this.win && this.win.document && this.win.document.item) {
          this.aras.setItemProperty(this.win.document.item, propertyName, value);
        }
      } catch (e) {
        console.error(`ArasAdapter: 更新屬性 [${propertyName}] 失敗`, e);
      }
    }

    /**
     * 判斷表單是否處於可編輯狀態 (Edit Mode)
     * @returns {boolean}
     */
    isEditMode() {
      try {
        const doc = this.win ? this.win.document : null;
        if (doc && typeof doc.isEditMode !== "undefined") {
          return Boolean(doc.isEditMode);
        }
        if (this.aras && doc && doc.item) {
          return this.aras.isEditState(doc.item);
        }
      } catch (e) {
        console.warn("ArasAdapter: 檢測 isEditMode 失敗", e);
      }
      return false;
    }

    /**
     * 透過 IOM 查詢 bcs_label 目錄及其關聯標籤 (包含多語系 label)
     * @param {string} categoryName - 標籤分類目錄名稱
     * @returns {Promise<Array<LabelTag>>}
     */
    async fetchAvailableTags(categoryName) {
      return new Promise((resolve) => {
        if (!this.aras || typeof this.aras.newIOMItem !== "function") {
          console.warn("ArasAdapter: 找不到 aras.newIOMItem，返回空標籤清單。");
          return resolve([]);
        }

        try {
          const query = this.aras.newIOMItem("bcs_label", "get");
          query.setAttribute("select", "name");
          query.setProperty("name", categoryName);

          const relQuery = this.aras.newIOMItem("bcs_label_tags", "get");
          relQuery.setAttribute("select", "sort_id,name,label,color");
          relQuery.setAttribute("orderBy", "sort_id");
          query.addRelationship(relQuery);

          const response = query.apply();
          if (response.isError()) {
            console.warn(`ArasAdapter: 找不到標籤目錄 [${categoryName}]：`, response.getErrorString());
            return resolve([]);
          }

          const tags = [];
          const relationships = response.getRelationships("bcs_label_tags");
          const count = relationships.getItemCount();

          for (let i = 0; i < count; i++) {
            const item = relationships.getItemByIndex(i);
            const name = item.getProperty("name");
            const defaultLabel = item.getProperty("label") || name;
            const color = item.getProperty("color") || "#3B82F6";
            const sortId = parseFloat(item.getProperty("sort_id")) || (i + 1) * 10;

            const labelsDict = {};
            labelsDict["default"] = defaultLabel;
            const currLang = this.getCurrentLanguage();
            labelsDict[currLang] = defaultLabel;

            tags.push(new LabelTag(name, defaultLabel, color, sortId, labelsDict));
          }

          resolve(tags);
        } catch (err) {
          console.error("ArasAdapter: 執行 IOM 查詢 bcs_label_tags 時發生異常：", err);
          resolve([]);
        }
      });
    }
  }

  return ArasAdapter;
});
