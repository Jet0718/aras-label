// @ts-nocheck
/**
 * @file bcs_main_grid_extension.js
 * @description Aras Innovator R36 Main Grid 多標籤彩色徽章渲染與搜尋列選擇器組件
 * 
 * 功能特點：
 * 1. 【網格彩化】：自動將 Main Grid 列表中「標記 (labels)」欄位的生硬 JSON 字串解析並渲染為美觀的彩色徽章 (Chips)。
 * 2. 【搜尋選擇器】：在搜尋列的「標記」輸入框掛載互動式標籤挑選彈窗 (Popover)，支援多選標籤與 AND/OR 條件切換。
 * 3. 【後端聯動】：選取標籤後自動填入搜尋條件並觸發搜尋，無縫對接後端 bcs_label_search_handler (onBeforeGet) 轉譯。
 * 4. 【多環境相容】：支援作為 CUI Init Method、Action 或全域注入執行。
 */

(function () {
  if (window._bcs_main_grid_extension_initialized) {
    return;
  }
  window._bcs_main_grid_extension_initialized = true;

  console.log("[bcs_label_grid] 正在啟動 Aras Main Grid 多標籤增強擴充模組...");

  /** @type {any} */
  const arasObj = window.aras || (window.parent && window.parent.aras) || (window.top && window.top.aras);

  // 1. 取得當前使用者登入語系
  let currentLang = "zh-TW";
  try {
    if (arasObj && typeof arasObj.getSessionContext === "function") {
      currentLang = arasObj.getSessionContext().getLanguageCode() || "zh-TW";
    } else if (arasObj && typeof arasObj.getLanguageCode === "function") {
      currentLang = arasObj.getLanguageCode() || "zh-TW";
    }
  } catch (e) {
    currentLang = "zh-TW";
  }

  // 2. 注入自訂 CSS 樣式
  function injectStyles() {
    if (document.getElementById("bcs_main_grid_styles")) return;
    const styleEl = document.createElement("style");
    styleEl.id = "bcs_main_grid_styles";
    styleEl.textContent = `
      /* Grid 單元格彩色標籤徽章 */
      .bcs-grid-tags-cell {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
        padding: 2px 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .bcs-grid-tag-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 500;
        line-height: 1.3;
        color: #FFFFFF;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        white-space: nowrap;
        user-select: none;
        transition: transform 0.12s ease;
      }
      .bcs-grid-tag-badge:hover {
        transform: translateY(-1px);
      }

      /* 搜尋列標籤選擇按鈕與容器 */
      .bcs-search-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
        height: 100%;
      }
      .bcs-search-picker-btn {
        position: absolute;
        right: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border: none;
        background: rgba(59, 130, 246, 0.1);
        color: #2563EB;
        cursor: pointer;
        border-radius: 3px;
        padding: 0;
        transition: all 0.15s ease;
        z-index: 5;
      }
      .bcs-search-picker-btn:hover {
        background: #2563EB;
        color: #FFFFFF;
      }

      /* 搜尋標籤彈出浮層 (Popover) */
      .bcs-search-popover {
        position: fixed;
        background: #FFFFFF;
        border: 1px solid #CBD5E1;
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        z-index: 99999;
        padding: 10px;
        width: 290px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-sizing: border-box;
        display: none;
      }
      .bcs-search-popover.is-open {
        display: block;
      }
      .bcs-popover-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 8px;
        border-bottom: 1px solid #F1F5F9;
        margin-bottom: 8px;
      }
      .bcs-popover-title {
        font-size: 12px;
        font-weight: 600;
        color: #1E293B;
      }
      .bcs-mode-toggle {
        display: inline-flex;
        background: #F1F5F9;
        border-radius: 4px;
        padding: 2px;
        gap: 2px;
      }
      .bcs-mode-btn {
        border: none;
        background: transparent;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 3px;
        cursor: pointer;
        color: #64748B;
        font-weight: 500;
      }
      .bcs-mode-btn.is-active {
        background: #3B82F6;
        color: #FFFFFF;
      }
      .bcs-popover-list {
        max-height: 200px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .bcs-popover-item {
        display: flex;
        align-items: center;
        padding: 5px 8px;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.12s ease;
      }
      .bcs-popover-item:hover {
        background-color: #F8FAFC;
      }
      .bcs-popover-item.is-selected {
        background-color: #EFF6FF;
      }
      .bcs-popover-checkbox {
        margin-right: 8px;
        cursor: pointer;
      }
      .bcs-popover-tag-preview {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 500;
      }
      .bcs-popover-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #F1F5F9;
      }
      .bcs-popover-action-btn {
        padding: 4px 10px;
        font-size: 11px;
        border-radius: 4px;
        border: 1px solid #CBD5E1;
        background: #FFFFFF;
        color: #475569;
        cursor: pointer;
        transition: all 0.12s ease;
      }
      .bcs-popover-action-btn.apply {
        background: #2563EB;
        color: #FFFFFF;
        border-color: #1D4ED8;
        font-weight: 500;
      }
      .bcs-popover-action-btn:hover {
        opacity: 0.9;
      }
    `;
    document.head.appendChild(styleEl);
  }

  // 3. 取得標籤目錄 (bcs_label_tags)
  /** @type {Array<{name: string, label: string, color: string, sort_id: number}>} */
  let availableTags = [];
  function loadAvailableTags() {
    if (!arasObj || typeof arasObj.newIOMItem !== "function") return;
    try {
      const q = arasObj.newIOMItem("bcs_label", "get");
      q.setAttribute("select", "name");
      q.setProperty("name", "Part_Labels");
      const rel = arasObj.newIOMItem("bcs_label_tags", "get");
      rel.setAttribute("select", "sort_id,name,label,color");
      rel.setAttribute("orderBy", "sort_id");
      q.addRelationship(rel);
      const res = q.apply();
      if (!res.isError()) {
        const rels = res.getRelationships("bcs_label_tags");
        availableTags = [];
        for (let i = 0; i < rels.getItemCount(); i++) {
          const it = rels.getItemByIndex(i);
          const name = it.getProperty("name");
          const label = it.getProperty("label") || name;
          const color = it.getProperty("color") || "#3B82F6";
          const sort_id = parseFloat(it.getProperty("sort_id")) || 0;
          availableTags.push({ name, label, color, sort_id });
        }
      }
    } catch (e) {
      console.warn("[bcs_label_grid] 載入標籤目錄失敗：", e);
    }
  }

  /**
   * 計算高對比文字顏色 (深底配白字，淺底配深字)
   * @param {string} hexColor - 十六進制顏色碼
   * @returns {string} 高對比前景色
   */
  function getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== "string") return "#FFFFFF";
    const clean = hexColor.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? "#1E293B" : "#FFFFFF";
  }

  /**
   * 格式化單一單元格的 JSON 內容為彩色徽章 (Chips)
   * @param {HTMLElement} cellEl - 網格單元格元素
   */
  function formatCellElement(cellEl) {
    if (!cellEl || cellEl.dataset.bcsFormatted === "true") return;
    const text = (cellEl.textContent || "").trim();
    if (!text.startsWith("[") || !text.includes('"name":')) return;

    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr) || arr.length === 0) return;

      const container = document.createElement("div");
      container.className = "bcs-grid-tags-cell";

      arr.forEach((tag) => {
        let displayLabel = tag.label || tag.name;
        if (tag.labels && typeof tag.labels === "object") {
          displayLabel = tag.labels[currentLang] || tag.labels["default"] || displayLabel;
        }
        const badge = document.createElement("span");
        badge.className = "bcs-grid-tag-badge";
        badge.style.backgroundColor = tag.color || "#3B82F6";
        badge.style.color = getContrastColor(tag.color);
        badge.title = tag.name;
        badge.textContent = displayLabel;
        container.appendChild(badge);
      });

      cellEl.innerHTML = "";
      cellEl.appendChild(container);
      cellEl.dataset.bcsFormatted = "true";
    } catch (e) {}
  }

  // 6. 掃描並彩化當前網格所有單元格
  function formatGridRows() {
    const cells = document.querySelectorAll(".aras-grid-row-cell, td[role='gridcell'], div[role='gridcell']");
    cells.forEach((cell) => {
      formatCellElement(/** @type {HTMLElement} */ (cell));
    });
  }

  // 7. 搜尋列標籤挑選面板 (Search Picker Popover)
  /** @type {HTMLElement|null} */
  let activePopover = null;

  /**
   * 建立或取得搜尋列 Popover 控制器
   * @param {HTMLInputElement} inputEl - 搜尋列輸入框
   * @returns {{open: Function, close: Function}} 控制器介面
   */
  function createSearchPopover(inputEl) {
    if (/** @type {any} */ (inputEl)._bcsPopover) return /** @type {any} */ (inputEl)._bcsPopover;

    const popover = document.createElement("div");
    popover.className = "bcs-search-popover";
    let matchMode = "AND";
    /** @type {Set<string>} */
    const selectedKeys = new Set();

    // 建立浮層內部結構
    popover.innerHTML = `
      <div class="bcs-popover-header">
        <span class="bcs-popover-title">標籤篩選過濾</span>
        <div class="bcs-mode-toggle">
          <button type="button" class="bcs-mode-btn is-active" data-mode="AND">且 (AND)</button>
          <button type="button" class="bcs-mode-btn" data-mode="OR">或 (OR)</button>
        </div>
      </div>
      <div class="bcs-popover-list"></div>
      <div class="bcs-popover-footer">
        <button type="button" class="bcs-popover-action-btn clear">清空</button>
        <button type="button" class="bcs-popover-action-btn apply">套用搜尋</button>
      </div>
    `;
    document.body.appendChild(popover);

    const listEl = popover.querySelector(".bcs-popover-list");
    const modeBtns = popover.querySelectorAll(".bcs-mode-btn");
    const clearBtn = popover.querySelector(".clear");
    const applyBtn = popover.querySelector(".apply");

    // 模式切換
    modeBtns.forEach((btn) => {
      /** @param {MouseEvent} e */
      btn.onclick = function (e) {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        modeBtns.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        matchMode = (btn instanceof HTMLElement && btn.dataset.mode) ? btn.dataset.mode : "AND";
      };
    });

    // 渲染可用標籤列表
    function renderList() {
      if (!listEl) return;
      listEl.innerHTML = "";
      if (availableTags.length === 0) {
        listEl.innerHTML = '<div style="padding:10px;text-align:center;font-size:11px;color:#94A3B8;">無可用標籤定義</div>';
        return;
      }
      availableTags.forEach((tag) => {
        const itemEl = document.createElement("div");
        itemEl.className = "bcs-popover-item";
        const isChecked = selectedKeys.has(tag.name);
        if (isChecked) itemEl.classList.add("is-selected");

        itemEl.innerHTML = `
          <input type="checkbox" class="bcs-popover-checkbox" ${isChecked ? "checked" : ""} />
          <span class="bcs-popover-tag-preview" style="background-color: ${tag.color}; color: ${getContrastColor(tag.color)};">
            ${tag.label || tag.name}
          </span>
        `;

        /** @param {MouseEvent} e */
        itemEl.onclick = function (e) {
          if (e && typeof e.stopPropagation === "function") e.stopPropagation();
          const checkbox = itemEl.querySelector(".bcs-popover-checkbox");
          if (!checkbox) return;
          const nextChecked = e.target !== checkbox ? !checkbox.checked : checkbox.checked;
          checkbox.checked = nextChecked;
          if (nextChecked) {
            selectedKeys.add(tag.name);
            itemEl.classList.add("is-selected");
          } else {
            selectedKeys.delete(tag.name);
            itemEl.classList.remove("is-selected");
          }
        };

        listEl.appendChild(itemEl);
      });
    }

    // 清空操作
    if (clearBtn) {
      /** @param {MouseEvent} e */
      clearBtn.onclick = function (e) {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        selectedKeys.clear();
        renderList();
        inputEl.value = "";
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        closePopover();
      };
    }

    // 套用搜尋
    if (applyBtn) {
      /** @param {MouseEvent} e */
      applyBtn.onclick = function (e) {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        /** @type {string[]} */
        const chosenLabels = [];
        availableTags.forEach((t) => {
          if (selectedKeys.has(t.name)) {
            chosenLabels.push(t.label || t.name);
          }
        });

        const criteriaText = chosenLabels.join(matchMode === "OR" ? " | " : ",");
        inputEl.value = criteriaText;
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        closePopover();

        // 自動觸發 Aras 主搜尋工具列的 Search 按鈕
        setTimeout(() => {
          const searchBtn = document.querySelector(".aras-button[data-id='search'], button[title='Search'], button[aria-label='Search']");
          if (searchBtn && typeof searchBtn.click === "function") {
            searchBtn.click();
          } else if (typeof window.onSearchCommand === "function") {
            window.onSearchCommand();
          }
        }, 100);
      };
    }

    function openPopover() {
      if (activePopover && activePopover !== popover) {
        activePopover.classList.remove("is-open");
      }
      activePopover = popover;
      loadAvailableTags();
      renderList();

      const rect = inputEl.getBoundingClientRect();
      popover.style.top = `${rect.bottom + 4}px`;
      popover.style.left = `${rect.left}px`;
      popover.classList.add("is-open");
    }

    function closePopover() {
      popover.classList.remove("is-open");
      if (activePopover === popover) activePopover = null;
    }

    /** @param {MouseEvent} e */
    document.addEventListener("mousedown", function (e) {
      const targetNode = /** @type {Node} */ (e.target);
      if (!popover.contains(targetNode) && targetNode !== inputEl && !(targetNode instanceof Element && targetNode.closest(".bcs-search-picker-btn"))) {
        closePopover();
      }
    });

    const handler = { open: openPopover, close: closePopover };
    /** @type {any} */ (inputEl)._bcsPopover = handler;
    return handler;
  }

  // 8. 掛載搜尋列標籤輸入框
  function attachSearchInput() {
    // 尋找「標記」或「labels」欄位對應的搜尋輸入框
    const inputs = document.querySelectorAll(".aras-grid-search-row-cell input, tr.aras-grid-search-row input, .aras-grid-search-cell input");
    inputs.forEach((inputNode) => {
      const input = /** @type {HTMLInputElement} */ (inputNode);
      if (/** @type {any} */ (input)._bcsSearchAttached) return;

      // 檢查是否為 labels 欄位 (透過 placeholder, name 或父層表頭識別)
      const parentCell = input.closest("td, th, div[role='gridcell']");
      const colIndex = parentCell ? parentCell.getAttribute("data-index") : null;

      // 尋找表頭文字是否包含「標記」或「labels」
      let isLabelsCol = false;
      const headers = document.querySelectorAll(".aras-grid-header-cell, th[role='columnheader']");
      headers.forEach((th) => {
        if (colIndex && th.getAttribute("data-index") === colIndex) {
          if (th.textContent && (th.textContent.includes("標記") || th.textContent.includes("labels"))) {
            isLabelsCol = true;
          }
        } else if (th.textContent && (th.textContent.includes("標記") || th.textContent.includes("labels"))) {
          // 若無精確 index，檢測水平位置相近度
          const thRect = th.getBoundingClientRect();
          const inRect = input.getBoundingClientRect();
          if (Math.abs(thRect.left - inRect.left) < 30) {
            isLabelsCol = true;
          }
        }
      });

      if (isLabelsCol) {
        /** @type {any} */ (input)._bcsSearchAttached = true;
        input.placeholder = "點擊挑選標籤...";
        input.style.paddingRight = "24px";

        // 在輸入框右側掛載標籤小圖示按鈕
        const wrapper = document.createElement("div");
        wrapper.className = "bcs-search-wrapper";
        if (input.parentNode) {
          input.parentNode.insertBefore(wrapper, input);
          wrapper.appendChild(input);
        }

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bcs-search-picker-btn";
        btn.title = "點選標籤篩選";
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path></svg>`;

        wrapper.appendChild(btn);

        const popoverHandler = createSearchPopover(input);
        /** @param {MouseEvent} e */
        btn.onclick = function (e) {
          if (e && typeof e.preventDefault === "function") e.preventDefault();
          if (e && typeof e.stopPropagation === "function") e.stopPropagation();
          popoverHandler.open();
        };
        /** @param {MouseEvent} e */
        input.onclick = function (e) {
          if (e && typeof e.stopPropagation === "function") e.stopPropagation();
          popoverHandler.open();
        };
        input.onfocus = function () {
          popoverHandler.open();
        };
      }
    });
  }

  // 9. 啟動觀察器與週期掃描
  injectStyles();
  loadAvailableTags();

  // 初次執行
  setTimeout(() => {
    formatGridRows();
    attachSearchInput();
  }, 300);

  // 使用 MutationObserver 持續監聽 Grid DOM 變化 (翻頁、搜尋、捲動)
  const observer = new MutationObserver(() => {
    formatGridRows();
    attachSearchInput();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log("[bcs_label_grid] Aras Main Grid 多標籤增強擴充模組啟動成功！");
})();

