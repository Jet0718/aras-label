// Aras Innovator R36 Main Grid 多標籤彩色徽章渲染與搜尋列選擇器組件
// 功能：跨 iframe 尋找主網格，將生硬的 labels JSON 轉換為彩色徽章，並掛載搜尋選擇器

(function () {
  console.log("[bcs_label_grid] 正在啟動 Aras Main Grid 多標籤增強擴充模組 (跨 frame 掃描版)...");

  // 取得 Aras 核心全域物件 (相容當前視窗、父視窗與頂層視窗)
  const arasObj = window.aras || (window.parent && window.parent.aras) || (window.top && window.top.aras);

  // 1. 取得當前使用者登入語系
  let currentLang = "zh-TW";
  try {
    if (arasObj && typeof arasObj.getSessionContext === "function") {
      currentLang = arasObj.getSessionContext().getLanguageCode() || "zh-TW";
    } else if (arasObj && typeof arasObj.getLanguageCode === "function") {
      currentLang = arasObj.getLanguageCode() || "zh-TW";
    }
  } catch (errLang) {
    currentLang = "zh-TW";
  }

  // 2. 注入自訂 CSS 樣式至指定 Document
  function injectStyles(targetDoc) {
    const doc = targetDoc || document;
    if (!doc || !doc.head || doc.getElementById("bcs_main_grid_styles")) return;
    const styleEl = doc.createElement("style");
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
    doc.head.appendChild(styleEl);
  }

  // 3. 取得標籤目錄 (bcs_label_tags)
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
    } catch (errTags) {
      console.warn("[bcs_label_grid] 載入標籤目錄失敗：", errTags);
    }
  }

  // 4. 計算高對比文字顏色 (深底配白字，淺底配深字)
  function getContrastColor(hexColor = "") {
    if (!hexColor || typeof hexColor !== "string") return "#FFFFFF";
    const clean = hexColor.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? "#1E293B" : "#FFFFFF";
  }

  // 5. 格式化單一單元格的 JSON 內容為彩色徽章 (Chips)
  function formatCellElement(cellEl = null, targetDoc = document) {
    if (!cellEl || cellEl.dataset.bcsFormatted === "true") return;
    const text = (cellEl.textContent || "").trim();
    if (!text.startsWith("[") || !text.includes('"name":')) return;

    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr) || arr.length === 0) return;

      const container = targetDoc.createElement("div");
      container.className = "bcs-grid-tags-cell";

      for (let i = 0; i < arr.length; i++) {
        const tag = arr[i];
        let displayLabel = tag.label || tag.name;
        if (tag.labels && typeof tag.labels === "object") {
          displayLabel = tag.labels[currentLang] || tag.labels["default"] || displayLabel;
        }
        const badge = targetDoc.createElement("span");
        badge.className = "bcs-grid-tag-badge";
        badge.style.backgroundColor = tag.color || "#3B82F6";
        badge.style.color = getContrastColor(tag.color);
        badge.title = tag.name;
        badge.textContent = displayLabel;
        container.appendChild(badge);
      }

      cellEl.innerHTML = "";
      cellEl.appendChild(container);
      cellEl.dataset.bcsFormatted = "true";
    } catch (errJson) {}
  }

  // 6. 掃描並彩化指定 Document 中所有單元格
  function formatGridRows(targetDoc) {
    const doc = targetDoc || document;
    if (!doc) return 0;
    const cells = doc.querySelectorAll(".aras-grid-row-cell, td[role='gridcell'], div[role='gridcell']");
    let count = 0;
    for (let i = 0; i < cells.length; i++) {
      formatCellElement(cells[i], doc);
      count++;
    }
    return count;
  }

  // 7. 搜尋列標籤挑選面板 (Search Picker Popover)
  let activePopover = null;
  function createSearchPopover(inputEl = null, targetDoc = document) {
    if (!inputEl) return null;
    if (inputEl._bcsPopover) return inputEl._bcsPopover;

    const doc = targetDoc || document;
    const popover = doc.createElement("div");
    popover.className = "bcs-search-popover";
    let matchMode = "AND";
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
    doc.body.appendChild(popover);

    const listEl = popover.querySelector(".bcs-popover-list");
    const modeBtns = popover.querySelectorAll(".bcs-mode-btn");
    const clearBtn = popover.querySelector(".clear");
    const applyBtn = popover.querySelector(".apply");

    // 模式切換按鈕事件
    for (let m = 0; m < modeBtns.length; m++) {
      const btn = modeBtns[m];
      btn.onclick = function () {
        const evt = window.event || (arguments.length > 0 ? arguments[0] : null);
        if (evt && typeof evt.stopPropagation === "function") evt.stopPropagation();
        for (let b = 0; b < modeBtns.length; b++) {
          modeBtns[b].classList.remove("is-active");
        }
        btn.classList.add("is-active");
        matchMode = btn.getAttribute("data-mode") || "AND";
      };
    }

    // 渲染可用標籤列表
    function renderList() {
      if (!listEl) return;
      listEl.innerHTML = "";
      if (availableTags.length === 0) {
        listEl.innerHTML = '<div style="padding:10px;text-align:center;font-size:11px;color:#94A3B8;">無可用標籤定義</div>';
        return;
      }
      for (let i = 0; i < availableTags.length; i++) {
        const tag = availableTags[i];
        const itemEl = doc.createElement("div");
        itemEl.className = "bcs-popover-item";
        const isChecked = selectedKeys.has(tag.name);
        if (isChecked) itemEl.classList.add("is-selected");

        itemEl.innerHTML = `
          <input type="checkbox" class="bcs-popover-checkbox" ${isChecked ? "checked" : ""} />
          <span class="bcs-popover-tag-preview" style="background-color: ${tag.color}; color: ${getContrastColor(tag.color)};">
            ${tag.label || tag.name}
          </span>
        `;

        itemEl.onclick = function () {
          const evt = window.event || (arguments.length > 0 ? arguments[0] : null);
          if (evt && typeof evt.stopPropagation === "function") evt.stopPropagation();
          const checkbox = itemEl.querySelector(".bcs-popover-checkbox");
          if (!checkbox) return;
          const nextChecked = (evt && evt.target !== checkbox) ? !checkbox.checked : checkbox.checked;
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
      }
    }

    // 清空操作
    if (clearBtn) {
      clearBtn.onclick = function () {
        const evt = window.event || (arguments.length > 0 ? arguments[0] : null);
        if (evt && typeof evt.stopPropagation === "function") evt.stopPropagation();
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
      applyBtn.onclick = function () {
        const evt = window.event || (arguments.length > 0 ? arguments[0] : null);
        if (evt && typeof evt.stopPropagation === "function") evt.stopPropagation();
        const chosenLabels = [];
        for (let i = 0; i < availableTags.length; i++) {
          const t = availableTags[i];
          if (selectedKeys.has(t.name)) {
            chosenLabels.push(t.label || t.name);
          }
        }

        const criteriaText = chosenLabels.join(matchMode === "OR" ? " | " : ",");
        inputEl.value = criteriaText;
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        closePopover();

        // 自動觸發 Aras 主搜尋工具列的 Search 按鈕
        setTimeout(() => {
          const searchBtn = doc.querySelector(".aras-button[data-id='search'], button[title='Search'], button[aria-label='Search']");
          if (searchBtn && typeof searchBtn.click === "function") {
            searchBtn.click();
          } else {
            const win = doc.defaultView || window;
            if (win && typeof win.onSearchCommand === "function") {
              win.onSearchCommand();
            }
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
      popover.style.top = (rect.bottom + 4) + "px";
      popover.style.left = rect.left + "px";
      popover.classList.add("is-open");
    }

    function closePopover() {
      popover.classList.remove("is-open");
      if (activePopover === popover) activePopover = null;
    }

    doc.addEventListener("mousedown", function () {
      const evt = window.event || (arguments.length > 0 ? arguments[0] : null);
      if (!evt) return;
      const targetNode = evt.target;
      if (!popover.contains(targetNode) && targetNode !== inputEl && !(targetNode.closest && targetNode.closest(".bcs-search-picker-btn"))) {
        closePopover();
      }
    });

    const handler = { open: openPopover, close: closePopover };
    inputEl._bcsPopover = handler;
    return handler;
  }

  // 8. 掛載搜尋列標籤輸入框
  function attachSearchInput(targetDoc, targetWin) {
    const doc = targetDoc || document;
    if (!doc) return 0;
    const inputs = doc.querySelectorAll(".aras-grid-search-row-cell input, tr.aras-grid-search-row input, .aras-grid-search-cell input");
    let attachedCount = 0;

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      if (input._bcsSearchAttached) continue;

      // 檢查是否為 labels 欄位 (透過 placeholder, name 或父層表頭識別)
      const parentCell = input.closest("td, th, div[role='gridcell']");
      const colIndex = parentCell ? parentCell.getAttribute("data-index") : null;

      let isLabelsCol = false;
      const headers = doc.querySelectorAll(".aras-grid-header-cell, th[role='columnheader']");
      for (let h = 0; h < headers.length; h++) {
        const th = headers[h];
        if (colIndex && th.getAttribute("data-index") === colIndex) {
          if (th.textContent && (th.textContent.includes("標記") || th.textContent.includes("labels"))) {
            isLabelsCol = true;
            break;
          }
        } else if (th.textContent && (th.textContent.includes("標記") || th.textContent.includes("labels"))) {
          const thRect = th.getBoundingClientRect();
          const inRect = input.getBoundingClientRect();
          if (Math.abs(thRect.left - inRect.left) < 30) {
            isLabelsCol = true;
            break;
          }
        }
      }

      if (isLabelsCol) {
        input._bcsSearchAttached = true;
        input.placeholder = "點擊挑選標籤...";
        input.style.paddingRight = "24px";

        // 在輸入框右側掛載標籤小圖示按鈕
        const wrapper = doc.createElement("div");
        wrapper.className = "bcs-search-wrapper";
        if (input.parentNode) {
          input.parentNode.insertBefore(wrapper, input);
          wrapper.appendChild(input);
        }

        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "bcs-search-picker-btn";
        btn.title = "點選標籤篩選";
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path></svg>`;

        wrapper.appendChild(btn);

        const popoverHandler = createSearchPopover(input, doc);
        btn.onclick = function () {
          const evt = window.event || (arguments.length > 0 ? arguments[0] : null);
          if (evt && typeof evt.preventDefault === "function") evt.preventDefault();
          if (evt && typeof evt.stopPropagation === "function") evt.stopPropagation();
          if (popoverHandler) popoverHandler.open();
        };
        input.onclick = function () {
          const evt = window.event || (arguments.length > 0 ? arguments[0] : null);
          if (evt && typeof evt.stopPropagation === "function") evt.stopPropagation();
          if (popoverHandler) popoverHandler.open();
        };
        input.onfocus = function () {
          if (popoverHandler) popoverHandler.open();
        };

        attachedCount++;
      }
    }

    return attachedCount;
  }

  // 9. 核心：遞迴收集全域所有 iframe 視窗
  function getAllFrames(rootWin) {
    const list = [];
    function scan(w) {
      if (!w) return;
      try {
        list.push(w);
        if (w.frames && w.frames.length > 0) {
          for (let f = 0; f < w.frames.length; f++) {
            try {
              scan(w.frames[f]);
            } catch (errFrame) {}
          }
        }
      } catch (errWin) {}
    }
    scan(rootWin || window.top || window);
    return list;
  }

  // 10. 對單一 Grid 視窗進行彩化與監控
  function enhanceWindow(w) {
    if (!w || !w.document) return false;
    const doc = w.document;
    const hasGrid = doc.querySelector(".aras-grid") || doc.querySelector(".aras-grid-row-cell") || doc.querySelector(".aras-grid-search-row-cell") || w.grid;
    if (!hasGrid) return false;

    injectStyles(doc);
    formatGridRows(doc);
    attachSearchInput(doc, w);

    if (!doc._bcsObserverBound && doc.body) {
      doc._bcsObserverBound = true;
      const obs = new MutationObserver(function () {
        formatGridRows(doc);
        attachSearchInput(doc, w);
      });
      obs.observe(doc.body, { childList: true, subtree: true });
    }

    return true;
  }

  // 11. 全域掃描與套用
  loadAvailableTags();
  const allWindows = getAllFrames(window.top || window);
  let enhancedGridCount = 0;

  for (let w = 0; w < allWindows.length; w++) {
    try {
      if (enhanceWindow(allWindows[w])) {
        enhancedGridCount++;
      }
    } catch (errEnhance) {}
  }

  console.log("[bcs_label_grid] 掃描完成，已對 " + enhancedGridCount + " 個 Grid 畫面完成彩化與掛載！");

  // 若由 Action 點擊觸發，彈出成功提示
  if (arasObj && typeof arasObj.AlertSuccess === "function") {
    arasObj.AlertSuccess("標記彩化與搜尋選擇器已成功啟用！已套用至 " + enhancedGridCount + " 個視窗。");
  }

  // 在頂層 window.top 啟動全域守護定時器 (確保切換分頁或新開搜尋時持續生效)
  const topWin = window.top || window;
  if (!topWin._bcs_global_grid_daemon) {
    topWin._bcs_global_grid_daemon = setInterval(function () {
      const currentFrames = getAllFrames(topWin);
      for (let k = 0; k < currentFrames.length; k++) {
        try {
          enhanceWindow(currentFrames[k]);
        } catch (e) {}
      }
    }, 1200);
  }
})();
