/**
 * @file MultiLabelController.js
 * @description 多標籤核心控制器，協調 Store、Renderer 與 Adapter，實現雙向資料綁定與多語系即時同步。
 * 採用 UMD 模式封裝。
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("../core/LabelStore"),
      require("../core/LabelRenderer"),
      require("../models/LabelTag")
    );
  } else {
    root.MultiLabelController = factory(root.LabelStore, root.LabelRenderer, root.LabelTag);
  }
})(typeof window !== "undefined" ? window : global, function (LabelStore, LabelRenderer, LabelTag) {
  class MultiLabelController {
    /**
     * 建構子：初始化控制器
     * @param {Object} options - 控制器配置參數
     * @param {HTMLElement|string} options.container - 掛載 DOM 容器或 ID
     * @param {string} options.propertyName - 目標儲存 JSON 的 Aras 屬性名稱 (如 "labels")
     * @param {string} options.labelCategoryName - bcs_label 目錄名稱 (如 "Part_Labels")
     * @param {IArasAdapter} options.adapter - Aras 適配器實體
     */
    constructor(options) {
      if (!options || !options.adapter || !options.propertyName) {
        throw new Error("MultiLabelController: 缺少必要的 adapter 或 propertyName 配置。");
      }

      this.config = {
        container: options.container,
        propertyName: options.propertyName,
        labelCategoryName: options.labelCategoryName || "Part_Labels",
        allowCustomInput: Boolean(options.allowCustomInput)
      };

      this.adapter = options.adapter;
      this.store = new LabelStore();
      this.renderer = new LabelRenderer(options.container);
      this.availableTags = [];
      this.currentLanguage = "zh-TW";

      this.bindRendererEvents();
    }

    bindRendererEvents() {
      this.renderer.bindEvents({
        onSelectTag: (tag) => this.handleSelectTag(tag),
        onRemoveTag: (name) => this.handleRemoveTag(name),
        onRemoveLastTag: () => this.handleRemoveLastTag(),
        onSearchInput: (query) => this.handleSearchInput(query)
      });
    }

    async init() {
      this.currentLanguage = this.adapter.getCurrentLanguage() || "zh-TW";
      this.availableTags = await this.adapter.fetchAvailableTags(this.config.labelCategoryName);

      const rawJSON = this.adapter.getPropertyValue(this.config.propertyName);
      this.store.deserializeJSON(rawJSON);

      const isEditMode = this.adapter.isEditMode();
      this.renderer.render(this.store.getAll(), isEditMode, this.currentLanguage);
    }

    handleSelectTag(tag) {
      if (!this.adapter.isEditMode()) return;

      const tagEntity = tag instanceof LabelTag ? tag : LabelTag.fromJSON(tag);

      if (this.store.has(tagEntity.name)) {
        this.renderer.shakeTag(tagEntity.name);
        return;
      }

      const added = this.store.add(tagEntity);
      if (added) {
        this.syncToAras();
        this.renderer.render(this.store.getAll(), true, this.currentLanguage);
        this.renderer.clearInput();
        this.renderer.hideDropdown();
      }
    }

    handleRemoveTag(name) {
      if (!this.adapter.isEditMode()) return;

      const removed = this.store.removeByName(name);
      if (removed) {
        this.syncToAras();
        this.renderer.render(this.store.getAll(), true, this.currentLanguage);
      }
    }

    handleRemoveLastTag() {
      if (!this.adapter.isEditMode()) return;
      const all = this.store.getAll();
      if (all.length > 0) {
        const lastTag = all[all.length - 1];
        this.handleRemoveTag(lastTag.name);
      }
    }

    handleSearchInput(query) {
      if (!this.adapter.isEditMode()) return;

      const lowerQuery = query.toLowerCase();

      const filtered = this.availableTags.filter((tag) => {
        if (this.store.has(tag.name)) {
          return false;
        }
        if (!lowerQuery) {
          return true;
        }
        const matchName = tag.name.toLowerCase().includes(lowerQuery);
        const matchLabel = tag.getDisplayLabel(this.currentLanguage).toLowerCase().includes(lowerQuery);
        return matchName || matchLabel;
      });

      this.renderer.renderDropdown(filtered, this.currentLanguage);
    }

    syncToAras() {
      const jsonString = this.store.serializeJSON();
      this.adapter.setPropertyValue(this.config.propertyName, jsonString);
    }

    changeLanguage(langCode) {
      this.currentLanguage = langCode;
      const isEditMode = this.adapter.isEditMode();
      this.renderer.render(this.store.getAll(), isEditMode, this.currentLanguage);
    }

    setEditMode(isEditMode) {
      this.renderer.render(this.store.getAll(), isEditMode, this.currentLanguage);
    }

    getSelectedTags() {
      return this.store.getAll();
    }
  }

  return MultiLabelController;
});
