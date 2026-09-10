/**
 * @file LabelSearchWidget.js
 * @description Aras Innovator Search 介面多標籤輸入與浮層選擇器組件。
 * 遵循單一職責原則 (SRP)，採用 UMD 模式封裝。
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("../models/LabelTag"),
      require("./SearchCriteriaTranslator")
    );
  } else {
    root.LabelSearchWidget = factory(root.LabelTag, root.SearchCriteriaTranslator);
  }
})(typeof window !== "undefined" ? window : global, function (LabelTag, SearchCriteriaTranslator) {
  class LabelSearchWidget {
    /**
     * 建構子：初始化搜尋欄位多標籤選擇器
     * @param {Object} options - 初始化參數
     * @param {HTMLElement|string} options.container - 輸入欄位容器元素或 ID
     * @param {Array<LabelTag>} [options.availableTags=[]] - 可選標籤清單 (來自 bcs_label_tags)
     * @param {string} [options.currentLanguage="zh-TW"] - 當前語系代碼
     * @param {string} [options.defaultMode="AND"] - 預設搜尋邏輯 ("AND" 或 "OR")
     * @param {Function} [options.onApplySearch] - 使用者套用搜尋時之回調
     */
    constructor(options = {}) {
      this.container = typeof options.container === "string" ? document.getElementById(options.container) : options.container;
      if (!this.container) {
        throw new Error("LabelSearchWidget: 找不到目標容器。");
      }

      this.availableTags = options.availableTags || [];
      this.currentLanguage = options.currentLanguage || "zh-TW";
      this.matchMode = options.defaultMode || "AND"; // 依使用者需求預設為 AND
      this.selectedTagKeys = new Set();
      this.onApplySearch = options.onApplySearch || (() => {});

      this.initDOM();
    }

    /**
     * 初始化 DOM 結構
     */
    initDOM() {
      this.container.classList.add("bcs-search-input-wrapper");
      this.container.innerHTML = `
        <input type="text" class="bcs-search-field-input" placeholder="選擇或鍵入標籤..." autocomplete="off" />
        <button type="button" class="bcs-search-picker-btn" title="選擇標籤">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
        </button>
        <div class="bcs-search-popover">
          <div class="bcs-popover-header">
            <span class="bcs-popover-title">標籤篩選</span>
            <div class="bcs-mode-toggle">
              <button type="button" class="bcs-mode-btn ${this.matchMode === "AND" ? "is-active" : ""}" data-mode="AND">且 (AND)</button>
              <button type="button" class="bcs-mode-btn ${this.matchMode === "OR" ? "is-active" : ""}" data-mode="OR">或 (OR)</button>
            </div>
          </div>
          <div class="bcs-popover-list"></div>
          <div class="bcs-popover-footer">
            <button type="button" class="bcs-popover-action-btn clear">清空</button>
            <button type="button" class="bcs-popover-action-btn apply">套用搜尋</button>
          </div>
        </div>
      `;

      this.inputEl = this.container.querySelector(".bcs-search-field-input");
      this.pickerBtn = this.container.querySelector(".bcs-search-picker-btn");
      this.popoverEl = this.container.querySelector(".bcs-search-popover");
      this.listEl = this.container.querySelector(".bcs-popover-list");
      this.modeBtns = this.container.querySelectorAll(".bcs-mode-btn");

      this.renderTagList();
      this.bindEvents();
    }

    /**
     * 繪製候選標籤列表
     */
    renderTagList() {
      this.listEl.innerHTML = "";
      this.availableTags.forEach((tag) => {
        const itemEl = document.createElement("div");
        itemEl.className = `bcs-popover-item ${this.selectedTagKeys.has(tag.name) ? "is-selected" : ""}`;
        itemEl.dataset.name = tag.name;

        const isChecked = this.selectedTagKeys.has(tag.name);
        const displayLabel = tag.getDisplayLabel(this.currentLanguage);
        const textColor = tag.getContrastTextColor();

        itemEl.innerHTML = `
          <input type="checkbox" class="bcs-popover-checkbox" ${isChecked ? "checked" : ""} />
          <span class="bcs-popover-tag-preview" style="background-color: ${tag.color}; color: ${textColor};">
            ${this.escapeHTML(displayLabel)}
          </span>
        `;

        itemEl.addEventListener("click", (e) => {
          if (e.target.tagName !== "INPUT") {
            const checkbox = itemEl.querySelector("input");
            checkbox.checked = !checkbox.checked;
          }
          this.toggleTag(tag.name);
        });

        this.listEl.appendChild(itemEl);
      });
    }

    /**
     * 綁定事件監聽
     */
    bindEvents() {
      // 點擊按鈕或輸入框切換展開浮層
      this.pickerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.togglePopover();
      });

      this.inputEl.addEventListener("focus", () => {
        this.openPopover();
      });

      // 點擊外部自動關閉
      document.addEventListener("click", (e) => {
        if (!this.container.contains(e.target)) {
          this.closePopover();
        }
      });

      // 切換 AND / OR 運算子
      this.modeBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          this.matchMode = btn.dataset.mode;
          this.modeBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
          this.syncInputText();
        });
      });

      // 清空按鈕
      this.container.querySelector(".bcs-popover-action-btn.clear").addEventListener("click", () => {
        this.selectedTagKeys.clear();
        this.renderTagList();
        this.inputEl.value = "";
        this.onApplySearch({ tagKeys: [], rawInput: "", mode: this.matchMode });
      });

      // 套用按鈕
      this.container.querySelector(".bcs-popover-action-btn.apply").addEventListener("click", () => {
        this.applyAndSearch();
      });

      // 輸入框鍵盤 Enter 觸發搜尋
      this.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.parseInputAndSearch();
        } else if (e.key === "Escape") {
          this.closePopover();
        }
      });
    }

    /**
     * 切換選取標籤
     * @param {string} tagKey
     */
    toggleTag(tagKey) {
      if (this.selectedTagKeys.has(tagKey)) {
        this.selectedTagKeys.delete(tagKey);
      } else {
        this.selectedTagKeys.add(tagKey);
      }
      this.renderTagList();
      this.syncInputText();
    }

    /**
     * 同步選取狀態至文字輸入框
     */
    syncInputText() {
      const selectedLabels = [];
      this.selectedTagKeys.forEach((key) => {
        const found = this.availableTags.find((t) => t.name === key);
        selectedLabels.push(found ? found.getDisplayLabel(this.currentLanguage) : key);
      });

      this.inputEl.value = selectedLabels.join(", ");
    }

    /**
     * 套用並發送搜尋
     */
    applyAndSearch() {
      this.syncInputText();
      this.closePopover();
      const keys = Array.from(this.selectedTagKeys);
      this.onApplySearch({
        tagKeys: keys,
        rawInput: this.inputEl.value.trim(),
        mode: this.matchMode
      });
    }

    /**
     * 手動鍵入時解析文字並觸發搜尋
     */
    parseInputAndSearch() {
      const raw = this.inputEl.value.trim();
      const terms = SearchCriteriaTranslator.parseTerms(raw);

      this.selectedTagKeys.clear();
      terms.forEach((term) => {
        const lower = term.toLowerCase();
        const found = this.availableTags.find(
          (t) => t.name.toLowerCase() === lower || t.getDisplayLabel(this.currentLanguage).toLowerCase() === lower
        );
        if (found) {
          this.selectedTagKeys.add(found.name);
        } else {
          this.selectedTagKeys.add(term);
        }
      });

      this.renderTagList();
      this.applyAndSearch();
    }

    openPopover() {
      this.popoverEl.classList.add("is-open");
    }

    closePopover() {
      this.popoverEl.classList.remove("is-open");
    }

    togglePopover() {
      this.popoverEl.classList.toggle("is-open");
    }

    /**
     * 更新語系
     * @param {string} langCode
     */
    setLanguage(langCode) {
      this.currentLanguage = langCode;
      this.renderTagList();
      this.syncInputText();
    }

    escapeHTML(str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  }

  return LabelSearchWidget;
});
