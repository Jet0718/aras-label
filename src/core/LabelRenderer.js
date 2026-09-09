/**
 * @file LabelRenderer.js
 * @description 標籤前端渲染器，負責 Chips 徽章、多語系呈現、搜尋下拉清單與動態互動事件處理。
 * 採用 UMD 模式封裝。
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../models/LabelTag"));
  } else {
    root.LabelRenderer = factory(root.LabelTag);
  }
})(typeof window !== "undefined" ? window : global, function (LabelTag) {
  class LabelRenderer {
    /**
     * 建構子：初始化渲染器
     * @param {HTMLElement|string} container - 掛載的 DOM 容器元素或其 ID
     */
    constructor(container) {
      this.container = typeof container === "string" ? document.getElementById(container) : container;
      if (!this.container) {
        throw new Error("LabelRenderer: 指定之 container 元素不存在。");
      }

      this.callbacks = {
        onSelectTag: () => {},
        onRemoveTag: () => {},
        onRemoveLastTag: () => {},
        onSearchInput: () => {}
      };

      this.highlightedIndex = -1;
      this.currentSuggestions = [];
      this.currentLanguage = "zh-TW";
      this.isEditMode = true;

      this.initDOMStructure();
    }

    initDOMStructure() {
      this.container.classList.add("bcs-multi-label-container");
      this.container.innerHTML = `
        <div class="bcs-tag-wrapper" id="bcsTagWrapper">
          <div class="bcs-tag-list" id="bcsTagList" style="display:contents;"></div>
          <input type="text" class="bcs-tag-input" id="bcsTagInput" placeholder="搜尋或新增標籤..." autocomplete="off" />
        </div>
        <div class="bcs-tag-dropdown" id="bcsTagDropdown"></div>
      `;

      this.wrapperEl = this.container.querySelector("#bcsTagWrapper");
      this.tagListEl = this.container.querySelector("#bcsTagList");
      this.inputEl = this.container.querySelector("#bcsTagInput");
      this.dropdownEl = this.container.querySelector("#bcsTagDropdown");

      this.bindInternalEvents();
    }

    bindInternalEvents() {
      this.wrapperEl.addEventListener("click", (e) => {
        if (this.isEditMode && e.target !== this.inputEl && !e.target.classList.contains("bcs-tag-remove-btn")) {
          this.inputEl.focus();
        }
      });

      this.inputEl.addEventListener("focus", () => {
        this.wrapperEl.classList.add("is-focused");
        this.callbacks.onSearchInput(this.inputEl.value.trim());
      });

      this.inputEl.addEventListener("blur", () => {
        this.wrapperEl.classList.remove("is-focused");
        setTimeout(() => this.hideDropdown(), 180);
      });

      this.inputEl.addEventListener("input", (e) => {
        this.highlightedIndex = -1;
        this.callbacks.onSearchInput(e.target.value.trim());
      });

      this.inputEl.addEventListener("keydown", (e) => {
        if (!this.isEditMode) return;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          this.moveHighlight(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          this.moveHighlight(-1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (this.highlightedIndex >= 0 && this.currentSuggestions[this.highlightedIndex]) {
            this.callbacks.onSelectTag(this.currentSuggestions[this.highlightedIndex]);
          } else if (this.currentSuggestions.length > 0) {
            this.callbacks.onSelectTag(this.currentSuggestions[0]);
          }
        } else if (e.key === "Backspace" && this.inputEl.value === "") {
          this.callbacks.onRemoveLastTag();
        } else if (e.key === "Escape") {
          this.hideDropdown();
        }
      });
    }

    bindEvents(callbacks) {
      this.callbacks = { ...this.callbacks, ...callbacks };
    }

    render(selectedTags, isEditMode = true, langCode = "zh-TW") {
      this.isEditMode = isEditMode;
      this.currentLanguage = langCode;

      this.tagListEl.innerHTML = "";

      if (this.isEditMode) {
        this.wrapperEl.classList.remove("is-readonly");
        this.inputEl.style.display = "inline-block";
      } else {
        this.wrapperEl.classList.add("is-readonly");
        this.inputEl.style.display = "none";
        this.hideDropdown();
      }

      selectedTags.forEach((tag) => {
        const badge = document.createElement("span");
        badge.className = "bcs-tag-badge";
        badge.dataset.name = tag.name;
        badge.style.backgroundColor = tag.color;
        badge.style.color = tag.getContrastTextColor();

        const displayText = tag.getDisplayLabel(this.currentLanguage);
        badge.innerHTML = `<span>${this.escapeHTML(displayText)}</span>`;

        if (this.isEditMode) {
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "bcs-tag-remove-btn";
          removeBtn.title = "移除標籤";
          removeBtn.innerHTML = "&times;";
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.callbacks.onRemoveTag(tag.name);
          });
          badge.appendChild(removeBtn);
        }

        this.tagListEl.appendChild(badge);
      });
    }

    renderDropdown(suggestions, langCode = "zh-TW") {
      if (!this.isEditMode) return;
      this.currentSuggestions = suggestions || [];
      this.currentLanguage = langCode;

      if (this.currentSuggestions.length === 0) {
        this.dropdownEl.innerHTML = `<div class="bcs-dropdown-empty">無匹配的標籤</div>`;
        this.dropdownEl.classList.add("is-open");
        return;
      }

      this.dropdownEl.innerHTML = "";
      this.currentSuggestions.forEach((tag, idx) => {
        const itemEl = document.createElement("div");
        itemEl.className = "bcs-dropdown-item";
        if (idx === this.highlightedIndex) {
          itemEl.classList.add("is-highlighted");
        }

        const displayLabel = tag.getDisplayLabel(this.currentLanguage);
        itemEl.innerHTML = `
          <div class="bcs-dropdown-left">
            <span class="bcs-dropdown-color-dot" style="background-color: ${tag.color};"></span>
            <strong>${this.escapeHTML(displayLabel)}</strong>
            <span class="bcs-dropdown-subtext">${this.escapeHTML(tag.name)}</span>
          </div>
        `;

        itemEl.addEventListener("mousedown", (e) => {
          e.preventDefault();
          this.callbacks.onSelectTag(tag);
          this.inputEl.value = "";
        });

        this.dropdownEl.appendChild(itemEl);
      });

      this.dropdownEl.classList.add("is-open");
    }

    moveHighlight(delta) {
      if (this.currentSuggestions.length === 0) return;
      this.highlightedIndex += delta;
      if (this.highlightedIndex < 0) this.highlightedIndex = this.currentSuggestions.length - 1;
      if (this.highlightedIndex >= this.currentSuggestions.length) this.highlightedIndex = 0;

      const items = this.dropdownEl.querySelectorAll(".bcs-dropdown-item");
      items.forEach((it, idx) => {
        if (idx === this.highlightedIndex) {
          it.classList.add("is-highlighted");
          it.scrollIntoView({ block: "nearest" });
        } else {
          it.classList.remove("is-highlighted");
        }
      });
    }

    hideDropdown() {
      this.dropdownEl.classList.remove("is-open");
      this.highlightedIndex = -1;
    }

    clearInput() {
      this.inputEl.value = "";
    }

    shakeTag(name) {
      const badge = this.tagListEl.querySelector(`.bcs-tag-badge[data-name="${name}"]`);
      if (badge) {
        badge.classList.remove("bcs-tag-shake");
        void badge.offsetWidth;
        badge.classList.add("bcs-tag-shake");
      }
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

  return LabelRenderer;
});
