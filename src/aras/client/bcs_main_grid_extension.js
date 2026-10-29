// @ts-nocheck
/**
 * ============================================================================
 * Aras Innovator R36 Main Grid 多標籤彩色徽章渲染與搜尋列選擇器擴充模組 (方案 A - Virtual DOM 防護強化版)
 * ============================================================================
 * 遵循 S.O.L.I.D 設計原則開發，提供兩大核心能力：
 *   1. 資料行即時彩化 (Virtual DOM 零破壞架構)：
 *      - 嚴禁使用 cellEl.innerHTML = "" 摧毀子節點，保留原生 TextNode 供 Inferno.js diffing 演算法比對。
 *      - 徹底消除欄位拖拉、調整欄寬時拋出之 'NotFoundError: Failed to execute insertBefore on Node' 例外。
 *      - 嚴格限定僅作用於 labels 欄位，徹底防止單元格節點複用時覆蓋 State 等其他欄位造成錯位。
 *   2. 搜尋列彩色浮層 (方案 A)：
 *      - 點擊搜尋列「標記」框或圖示按鈕彈出彩色標籤多選卡片 (Popover)。
 *      - 提供與 Form 表單 100% 一致之色票、多選勾選、AND/OR 模式切換與自動觸發搜尋。
 *      - 四層深度查詢模型同步 (currQryItem, searchContainer.searchMode, grid.head)。
 *
 * 架構特點：
 *   - 零破壞 Virtual DOM：保留原生節點，使用 CSS visibility/transparent 隱藏原生文字，浮動疊加徽章層。
 *   - 嚴格欄位鎖定：依據 grid.settings.indexHead 精確判定欄位，非 labels 欄位自動清理殘留增強層。
 *   - 防裁切定位：Popover 節點獨立掛載於頂層 body，採 position: fixed，徹底解決 overflow 裁切問題。
 *   - 嚴格型別預設值：全數參數賦予安全預設值，徹底杜絕 Monaco 語法提示 (Anti-TS80001, Anti-Implicit-Any, Anti-TS6133)。
 */

(function () {
  console.log("[bcs_label_grid] 正在啟動 Aras Main Grid 多標籤增強擴充模組 (方案 A - Virtual DOM 防護強化版)...");

  // 取得 Aras 核心全域物件 (相容當前視窗、父視窗與頂層視窗)
  const arasObj = window.aras || (window.parent && window.parent.aras) || (window.top && window.top.aras);

  // 1. 取得當前使用者登入語系 (支援 zt, zh-TW, en, zh-CN)
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

  // --------------------------------------------------------------------------
  // 2. 注入自訂現代化 CSS 樣式至指定 Document
  // 參數: targetDoc (預設 null) - 目標文檔物件
  // --------------------------------------------------------------------------
  function injectStyles(targetDoc = null) {
    const doc = targetDoc || document;
    if (!doc || !doc.head || doc.getElementById("bcs_main_grid_styles")) return;
    const styleEl = doc.createElement("style");
    styleEl.id = "bcs_main_grid_styles";
    styleEl.textContent = `
      /* 單元格標籤激活狀態：原生文字隱藏但 DOM 節點完整保留供 Virtual DOM 比對 */
      .aras-grid-row-cell.bcs-labels-cell-active {
        position: relative !important;
        font-size: 0 !important;
        color: transparent !important;
        overflow: hidden !important;
      }

      /* Grid 單元格彩色標籤徽章層 (以絕對定位覆蓋於單元格之上，零破壞原生子節點) */
      .bcs-grid-tags-cell {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
        padding: 2px 6px;
        background: inherit;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        pointer-events: none;
        z-index: 1;
      }
      .bcs-grid-tag-badge {
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 500;
        line-height: 1.35;
        color: #FFFFFF;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        white-space: nowrap;
        user-select: none;
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      .bcs-grid-tag-badge:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
      }

      /* 搜尋列標籤挑選輸入框樣式 */
      .bcs-search-input-active {
        cursor: pointer !important;
        background-color: #F8FAFC !important;
        transition: background-color 0.15s ease, border-color 0.15s ease;
      }
      .bcs-search-input-active:hover {
        background-color: #F1F5F9 !important;
      }
      .bcs-search-picker-badge-btn {
        position: absolute;
        right: 4px;
        top: 50%;
        transform: translateY(-50%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border: none;
        background: #3B82F6;
        color: #FFFFFF;
        cursor: pointer;
        border-radius: 4px;
        padding: 0;
        box-shadow: 0 1px 2px rgba(59, 130, 246, 0.3);
        transition: all 0.15s ease;
        z-index: 10;
      }
      .bcs-search-picker-badge-btn:hover {
        background: #2563EB;
        transform: translateY(-50%) scale(1.08);
      }

      /* 方案 A：搜尋標籤多選彈出卡片 (Popover，掛載於 body，Fixed 定位防裁切) */
      .bcs-search-popover {
        position: fixed;
        background: #FFFFFF;
        border: 1px solid #CBD5E1;
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        z-index: 999999;
        padding: 12px;
        width: 300px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        box-sizing: border-box;
        display: none;
        animation: bcsPopoverIn 0.15s ease-out;
      }
      @keyframes bcsPopoverIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
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
        margin-bottom: 10px;
      }
      .bcs-popover-title {
        font-size: 13px;
        font-weight: 600;
        color: #1E293B;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .bcs-mode-toggle {
        display: inline-flex;
        background: #F1F5F9;
        border-radius: 5px;
        padding: 2px;
        gap: 2px;
      }
      .bcs-mode-btn {
        border: none;
        background: transparent;
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 3px;
        cursor: pointer;
        color: #64748B;
        font-weight: 500;
        transition: all 0.12s ease;
      }
      .bcs-mode-btn.is-active {
        background: #3B82F6;
        color: #FFFFFF;
        box-shadow: 0 1px 2px rgba(59, 130, 246, 0.25);
      }
      .bcs-popover-list {
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-right: 2px;
      }
      .bcs-popover-item {
        display: flex;
        align-items: center;
        padding: 6px 8px;
        border-radius: 6px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.12s ease;
        user-select: none;
      }
      .bcs-popover-item:hover {
        background-color: #F8FAFC;
        border-color: #E2E8F0;
      }
      .bcs-popover-item.is-selected {
        background-color: #EFF6FF;
        border-color: #BFDBFE;
      }
      .bcs-popover-checkbox {
        margin-right: 8px;
        cursor: pointer;
        accent-color: #2563EB;
        width: 14px;
        height: 14px;
      }
      .bcs-popover-tag-preview {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 9999px;
        font-size: 11.5px;
        font-weight: 500;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      }
      .bcs-popover-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid #F1F5F9;
      }
      .bcs-popover-action-btn {
        padding: 5px 12px;
        font-size: 11.5px;
        border-radius: 5px;
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
      .bcs-popover-action-btn.apply:hover {
        background: #1D4ED8;
      }
      .bcs-popover-action-btn.clear:hover {
        background: #F1F5F9;
        color: #0F172A;
      }
    `;
    doc.head.appendChild(styleEl);
  }

  // --------------------------------------------------------------------------
  // 3. 取得標籤目錄 (bcs_label_tags)，帶快取與語系解析
  // --------------------------------------------------------------------------
  let availableTags = [];
  function loadAvailableTags() {
    if (!arasObj || typeof arasObj.newIOMItem !== "function") return;
    try {
      // 優先載入所有 bcs_label 及其關聯的 bcs_label_tags
      const q = arasObj.newIOMItem("bcs_label", "get");
      q.setAttribute("select", "name");
      const rel = arasObj.newIOMItem("bcs_label_tags", "get");
      rel.setAttribute("select", "sort_id,name,label,color");
      rel.setAttribute("orderBy", "sort_id");
      q.addRelationship(rel);
      const res = q.apply();
      if (!res.isError() && res.getItemCount() > 0) {
        availableTags = [];
        const seenNames = new Set();
        for (let idx = 0; idx < res.getItemCount(); idx++) {
          const cat = res.getItemByIndex(idx);
          const rels = cat.getRelationships("bcs_label_tags");
          for (let i = 0; i < rels.getItemCount(); i++) {
            const it = rels.getItemByIndex(i);
            const name = it.getProperty("name");
            if (!name || seenNames.has(name.toLowerCase())) continue;
            seenNames.add(name.toLowerCase());
            const label = it.getProperty("label") || name;
            const color = it.getProperty("color") || "#3B82F6";
            const sort_id = parseFloat(it.getProperty("sort_id")) || 0;
            availableTags.push({ name, label, color, sort_id });
          }
        }
      }
    } catch (errTags) {
      console.warn("[bcs_label_grid] 載入標籤目錄失敗：", errTags);
    }
  }

  // --------------------------------------------------------------------------
  // 4. 計算高對比文字顏色 (深底配白字，淺底配深字)
  // 參數: hexColor (預設 "") - 十六進制色彩碼
  // 回傳: 高對比文字色 ("#1E293B" 或 "#FFFFFF")
  // --------------------------------------------------------------------------
  function getContrastColor(hexColor = "") {
    if (!hexColor || typeof hexColor !== "string") return "#FFFFFF";
    const clean = hexColor.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? "#1E293B" : "#FFFFFF";
  }

  // --------------------------------------------------------------------------
  // 5. 偵測當前視窗中 Grid 的 labels 欄位索引與 Head ID
  // 參數: w (預設 null) - 目標視窗物件
  // 回傳: { headId: string, colIndex: number } 或 null
  // --------------------------------------------------------------------------
  function getLabelsColumnInfo(w = null) {
    if (!w || !w.grid || !w.grid.head) return null;
    try {
      const head = w.grid.head;
      const indexHead = (w.grid.settings && w.grid.settings.indexHead) || Array.from(head.keys());
      for (let i = 0; i < indexHead.length; i++) {
        const hId = indexHead[i];
        const colDef = head.get(hId);
        if (!colDef) continue;
        const name = (colDef.name || colDef.field || "").toLowerCase();
        const label = (colDef.label || "").toLowerCase();
        if (name === "labels" || label.includes("標記") || label.includes("標籤")) {
          return { headId: hId, colIndex: i };
        }
      }
    } catch (errCol) {}
    return null;
  }

  // --------------------------------------------------------------------------
  // 6. 安全格式化單一單元格 (零破壞 Virtual DOM，保留原生 TextNode 徹底防止 insertBefore 崩潰)
  // 參數: cellEl (預設 null) - 單元格元素
  // 參數: targetDoc (預設 null) - 目標文檔物件
  // 參數: isLabelsColumn (預設 true) - 是否確為標籤欄位
  // --------------------------------------------------------------------------
  function formatCellElementSafely(cellEl = null, targetDoc = null, isLabelsColumn = true) {
    if (!cellEl) return;

    // 若非標籤欄位 (例如被 Virtual DOM 複用給 State 或 Part Number)，立即清理殘留增強層並還原
    if (!isLabelsColumn) {
      const existingContainer = cellEl.querySelector(".bcs-grid-tags-cell");
      if (existingContainer) {
        existingContainer.remove();
      }
      cellEl.classList.remove("bcs-labels-cell-active");
      return;
    }

    const text = (cellEl.textContent || "").trim();
    // 檢查內容特徵是否為標籤 JSON 陣列
    if (!text.startsWith("[") || !text.includes('"name":')) {
      const existingContainer = cellEl.querySelector(".bcs-grid-tags-cell");
      if (existingContainer) {
        existingContainer.remove();
      }
      cellEl.classList.remove("bcs-labels-cell-active");
      return;
    }

    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr) || arr.length === 0) return;

      const doc = targetDoc || document;
      let container = cellEl.querySelector(".bcs-grid-tags-cell");
      if (!container) {
        container = doc.createElement("div");
        container.className = "bcs-grid-tags-cell";
        // 核心關鍵：絕對不使用 cellEl.innerHTML = ""！
        // 原生 TextNode 保留在 DOM 樹內供 Inferno.js diff 比對，消除 insertBefore 報錯
        cellEl.appendChild(container);
      }

      // 以 CSS 隱藏原生文字，絕不拔除原生節點
      cellEl.classList.add("bcs-labels-cell-active");

      // 檢查快取鍵值 (避免無謂重繪造成效能損耗)
      const cachedKey = arr.map((t = {}) => t.name || "").join(",");
      if (container.dataset.bcsTagsKey === cachedKey) {
        return;
      }
      container.dataset.bcsTagsKey = cachedKey;

      // 重新繪製徽章清單 (僅操作自訂 container 內部，不干擾 cellEl 的原生子節點！)
      container.innerHTML = "";
      for (let i = 0; i < arr.length; i++) {
        const tag = arr[i];
        let displayLabel = tag.label || tag.name;
        if (tag.labels && typeof tag.labels === "object") {
          displayLabel = tag.labels[currentLang] || tag.labels["zt"] || tag.labels["default"] || displayLabel;
        }
        const badge = doc.createElement("span");
        badge.className = "bcs-grid-tag-badge";
        badge.style.backgroundColor = tag.color || "#3B82F6";
        badge.style.color = getContrastColor(tag.color);
        badge.title = tag.name;
        badge.textContent = displayLabel;
        container.appendChild(badge);
      }
    } catch (errJson) {}
  }

  // --------------------------------------------------------------------------
  // 7. 掃描並彩化指定視窗之所有單元格 (嚴格限定標籤欄位)
  // 參數: w (預設 null) - 目標視窗物件
  // 回傳: 彩化數量 (number)
  // --------------------------------------------------------------------------
  function formatGridRowsSafely(w = null) {
    if (!w || !w.document) return 0;
    const doc = w.document;
    const colInfo = getLabelsColumnInfo(w);
    const rows = doc.querySelectorAll(".aras-grid-row, tr.aras-grid-row");
    let count = 0;

    if (rows && rows.length > 0 && colInfo && colInfo.colIndex !== undefined) {
      const targetColIdx = colInfo.colIndex;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const cells = row.children;
        for (let c = 0; c < cells.length; c++) {
          const cell = cells[c];
          const isTarget = (c === targetColIdx);
          formatCellElementSafely(cell, doc, isTarget);
          if (isTarget) count++;
        }
      }
    } else {
      // 若無 row 結構，安全掃描單元格，僅在完全符合 JSON 標籤時掛載
      const cells = doc.querySelectorAll(".aras-grid-row-cell, td[role='gridcell'], div[role='gridcell']");
      for (let i = 0; i < cells.length; i++) {
        formatCellElementSafely(cells[i], doc, true);
        count++;
      }
    }
    return count;
  }

  // --------------------------------------------------------------------------
  // 8. 四層深度同步 Aras 搜尋查詢模型 (QryItem, SearchMode, GridHead)
  // 參數: targetDoc (預設 null) - 目標 document 物件
  // 參數: criteriaText (預設 "") - 搜尋條件字串 (例如 "VIP重點" 或 "")
  // --------------------------------------------------------------------------
  function syncArasQueryModel(targetDoc = null, criteriaText = "") {
    const doc = targetDoc || document;
    const candidateWins = [
      doc.defaultView || window,
      window,
      window.parent,
      window.top
    ];

    for (let wIdx = 0; wIdx < candidateWins.length; wIdx++) {
      const w = candidateWins[wIdx];
      if (!w) continue;

      try {
        // 1. 同步 currQryItem (Aras 核心查詢物件)
        const qry = w.currQryItem ||
                    (w.searchContainer && w.searchContainer.currQryItem) ||
                    (w.searchContainer && w.searchContainer.searchMode && w.searchContainer.searchMode.currQryItem);
        if (qry && typeof qry.setProperty === "function") {
          if (criteriaText) {
            qry.setProperty("labels", criteriaText);
            if (typeof qry.setPropertyAttribute === "function") {
              qry.setPropertyAttribute("labels", "condition", "like");
            }
          } else {
            if (typeof qry.removeProperty === "function") {
              qry.removeProperty("labels");
            }
          }
        }

        // 2. 同步 searchContainer.searchMode 的 criteria
        if (w.searchContainer && w.searchContainer.searchMode) {
          const sm = w.searchContainer.searchMode;
          if (typeof sm.setSearchCriteria === "function") {
            try {
              sm.setSearchCriteria("labels", criteriaText ? criteriaText : "");
            } catch (errSm) {}
          }
        }

        // 3. 同步 ArasModules.Grid / HyperGrid 的 head 定義
        if (w.grid && w.grid.head) {
          try {
            for (const colDef of w.grid.head.values()) {
              const colName = (colDef.name || colDef.field || "").toLowerCase();
              const colLabel = (colDef.label || "").toLowerCase();
              if (colName === "labels" || colLabel.includes("標記") || colLabel.includes("標籤")) {
                colDef.searchValue = criteriaText;
                break;
              }
            }
          } catch (errHead) {}
        }
      } catch (errWinSync) {}
    }
  }

  // --------------------------------------------------------------------------
  // 9. 方案 A：搜尋列標籤挑選卡片 (Popover Manager)
  // 參數: targetDoc (預設 null) - 目標文檔物件
  // --------------------------------------------------------------------------
  let activePopover = null;
  function getOrCreateSearchPopover(targetDoc = null) {
    const doc = targetDoc || document;
    if (doc._bcsGlobalPopover) return doc._bcsGlobalPopover;

    const popover = doc.createElement("div");
    popover.className = "bcs-search-popover";
    let matchMode = "AND";
    const selectedKeys = new Set();
    let currentBoundInput = null;

    popover.innerHTML = `
      <div class="bcs-popover-header">
        <span class="bcs-popover-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path></svg>
          標籤篩選過濾
        </span>
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
      btn.onclick = function (evt = null) {
        if (evt && typeof evt.stopPropagation === "function") evt.stopPropagation();
        for (let b = 0; b < modeBtns.length; b++) {
          modeBtns[b].classList.remove("is-active");
        }
        btn.classList.add("is-active");
        matchMode = btn.getAttribute("data-mode") || "AND";
      };
    }

    // 渲染候選標籤
    function renderList() {
      if (!listEl) return;
      listEl.innerHTML = "";
      if (availableTags.length === 0) {
        listEl.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:#94A3B8;">載入標籤目錄中或無可用標籤...</div>';
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

        itemEl.onclick = function (evt = null) {
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

    // 關閉浮層
    function closePopover() {
      popover.classList.remove("is-open");
      if (activePopover === popover) activePopover = null;
    }

    // 開啟並定位浮層
    function openPopover(targetInput = null) {
      if (!targetInput) return;
      currentBoundInput = targetInput;
      if (activePopover && activePopover !== popover) {
        activePopover.classList.remove("is-open");
      }
      activePopover = popover;
      loadAvailableTags();

      // 解析輸入框現有內容以勾選標籤
      selectedKeys.clear();
      const currentText = (targetInput.value || "").trim();
      if (currentText) {
        const parts = currentText.split(/[,;|，；\s]+/).map((p = "") => p.trim()).filter(Boolean);
        for (let i = 0; i < availableTags.length; i++) {
          const t = availableTags[i];
          if (parts.some((p = "") => p.toLowerCase() === (t.label || "").toLowerCase() || p.toLowerCase() === (t.name || "").toLowerCase())) {
            selectedKeys.add(t.name);
          }
        }
      }

      renderList();

      const rect = targetInput.getBoundingClientRect();
      const popoverWidth = 300;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 10) {
        left = window.innerWidth - popoverWidth - 10;
      }
      popover.style.top = (rect.bottom + 4) + "px";
      popover.style.left = Math.max(10, left) + "px";
      popover.classList.add("is-open");
    }

    // 清空操作
    if (clearBtn) {
      clearBtn.onclick = function (evt = null) {
        if (evt && typeof evt.stopPropagation === "function") evt.stopPropagation();
        selectedKeys.clear();
        renderList();
        if (currentBoundInput) {
          currentBoundInput.value = "";
          currentBoundInput.dispatchEvent(new Event("input", { bubbles: true }));
          currentBoundInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        syncArasQueryModel(doc, "");
        closePopover();
      };
    }

    // 套用搜尋
    if (applyBtn) {
      applyBtn.onclick = function (evt = null) {
        if (evt && typeof evt.stopPropagation === "function") evt.stopPropagation();
        if (!currentBoundInput) return;

        const chosenLabels = [];
        for (let i = 0; i < availableTags.length; i++) {
          const t = availableTags[i];
          if (selectedKeys.has(t.name)) {
            chosenLabels.push(t.label || t.name);
          }
        }

        const criteriaText = chosenLabels.join(matchMode === "OR" ? " | " : ", ");

        // 1. 第一層：DOM 賦值與完整原生事件鏈
        try {
          currentBoundInput.focus();
        } catch (errFocus) {}
        currentBoundInput.value = criteriaText;
        currentBoundInput.dispatchEvent(new Event("input", { bubbles: true }));
        currentBoundInput.dispatchEvent(new Event("change", { bubbles: true }));
        currentBoundInput.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", keyCode: 13, which: 13 }));
        currentBoundInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter", keyCode: 13, which: 13 }));
        try {
          currentBoundInput.blur();
        } catch (errBlur) {}

        // 2. 第二至四層：四層深度查詢模型同步 (currQryItem, searchMode, grid.head)
        syncArasQueryModel(doc, criteriaText);

        closePopover();

        // 3. 跨 Frame 自動尋找並觸發 Aras 主搜尋指令
        setTimeout(() => {
          const candidateWins = [
            doc.defaultView || window,
            window,
            window.parent,
            window.top
          ];

          for (let wIdx = 0; wIdx < candidateWins.length; wIdx++) {
            const w = candidateWins[wIdx];
            if (!w) continue;
            try {
              if (w.searchContainer && typeof w.searchContainer.onSearch === "function") {
                w.searchContainer.onSearch();
                break;
              }
              if (typeof w.onSearchCommand === "function") {
                w.onSearchCommand();
                break;
              }
              if (w.document) {
                const searchBtn = w.document.querySelector(
                  ".aras-button[data-id='search'], button[data-id='search'], button[title='Search'], button[aria-label='Search']"
                );
                if (searchBtn && typeof searchBtn.click === "function") {
                  searchBtn.click();
                  break;
                }
              }
            } catch (errWinSearch) {}
          }
        }, 100);
      };
    }

    // 監聽點擊外部與 Esc 鍵自動關閉
    doc.addEventListener("mousedown", function (evt = null) {
      if (!evt) return;
      const targetNode = evt.target;
      if (targetNode && !popover.contains(targetNode) && targetNode !== currentBoundInput && !(targetNode.closest && targetNode.closest(".bcs-search-picker-badge-btn"))) {
        closePopover();
      }
    });

    doc.addEventListener("keydown", function (evt = null) {
      if (evt && evt.key === "Escape") {
        closePopover();
      }
    });

    const manager = { open: openPopover, close: closePopover };
    doc._bcsGlobalPopover = manager;
    return manager;
  }

  // --------------------------------------------------------------------------
  // 10. 方案 A：掛載搜尋列標籤輸入框 (精確鎖定 labels 欄位，不破壞表頭 DOM)
  // 參數: w (預設 null) - 目標視窗物件
  // 回傳: 掛載成功數量 (number)
  // --------------------------------------------------------------------------
  function attachSearchInputSafely(w = null) {
    if (!w || !w.document) return 0;
    const doc = w.document;
    const colInfo = getLabelsColumnInfo(w);
    const popoverManager = getOrCreateSearchPopover(doc);

    // 尋找表頭搜尋列中所有 input
    const inputs = doc.querySelectorAll(
      ".aras-grid-search-row-cell input, tr.aras-grid-search-row input, .aras-grid-search-cell input, " +
      ".aras-grid-head-cell input, .aras-grid-head input, [role='columnheader'] input"
    );
    if (!inputs || inputs.length === 0) return 0;

    let targetInput = null;

    // 優先以 column index 或 head key 精確定位
    if (colInfo && colInfo.colIndex !== undefined) {
      // 在搜尋列單元格中找到對應索引
      const searchCells = doc.querySelectorAll(".aras-grid-search-row-cell, tr.aras-grid-search-row td, .aras-grid-search-cell");
      if (searchCells && searchCells.length > colInfo.colIndex) {
        const targetCell = searchCells[colInfo.colIndex];
        if (targetCell) {
          targetInput = targetCell.querySelector("input");
        }
      }
    }

    // 若未能直接以索引定位，透過表頭位置與屬性進行防護比對
    if (!targetInput) {
      const headerCells = doc.querySelectorAll(".aras-grid-head-cell, .aras-grid-header-cell, th[role='columnheader'], th");
      let targetLeft = null;
      for (let h = 0; h < headerCells.length; h++) {
        const th = headerCells[h];
        const text = (th.textContent || "").trim();
        const dataKey = th.getAttribute("data-key") || th.getAttribute("data-head-id") || "";
        if (text.includes("標記") || text.includes("標籤") || text.toLowerCase().includes("labels") || dataKey.toLowerCase() === "labels") {
          targetLeft = th.getBoundingClientRect().left;
          break;
        }
      }
      if (targetLeft !== null) {
        for (let i = 0; i < inputs.length; i++) {
          const inp = inputs[i];
          const rect = inp.getBoundingClientRect();
          if (Math.abs(rect.left - targetLeft) < 35) {
            targetInput = inp;
            break;
          }
        }
      }
    }

    if (!targetInput) return 0;

    if (!targetInput._bcsSearchAttached) {
      targetInput._bcsSearchAttached = true;
      targetInput.placeholder = "點擊挑選彩色標籤...";
      targetInput.classList.add("bcs-search-input-active");
      targetInput.style.paddingRight = "24px";

      const parentCell = targetInput.closest("td, th, div.aras-grid-head-cell, div.aras-grid-search-cell, div.aras-grid-search-row-cell");
      if (parentCell && !parentCell.querySelector(".bcs-search-picker-badge-btn")) {
        const currentPos = w.getComputedStyle(parentCell).position;
        if (!currentPos || currentPos === "static") {
          parentCell.style.position = "relative";
        }
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "bcs-search-picker-badge-btn";
        btn.title = "點擊開啟彩色標籤篩選卡片 (方案 A)";
        btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path></svg>`;

        btn.onclick = function (evt = null) {
          if (evt) {
            evt.preventDefault();
            evt.stopPropagation();
          }
          popoverManager.open(targetInput);
        };
        parentCell.appendChild(btn);
      }

      targetInput.onclick = function (evt = null) {
        if (evt && typeof evt.stopPropagation === "function") evt.stopPropagation();
        popoverManager.open(targetInput);
      };
      targetInput.onfocus = function () {
        popoverManager.open(targetInput);
      };

      // 監聽手動更換條件或清空事件，即時反向同步查詢模型
      targetInput.addEventListener("input", function () {
        syncArasQueryModel(doc, targetInput.value.trim());
      });
      targetInput.addEventListener("change", function () {
        syncArasQueryModel(doc, targetInput.value.trim());
      });
    }

    return 1;
  }

  // --------------------------------------------------------------------------
  // 11. 遞迴收集全域所有 iframe 視窗
  // 參數: rootWin (預設 null) - 根視窗物件
  // 回傳: 視窗陣列
  // --------------------------------------------------------------------------
  function getAllFrames(rootWin = null) {
    const list = [];
    function scan(w = null) {
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

  // --------------------------------------------------------------------------
  // 12. 對單一 Grid 視窗進行彩化與監控
  // 參數: w (預設 null) - 目標視窗物件
  // 回傳: 是否成功增強 (boolean)
  // --------------------------------------------------------------------------
  function enhanceWindow(w = null) {
    if (!w || !w.document) return false;
    const doc = w.document;
    const hasGrid = doc.querySelector(".aras-grid") || doc.querySelector(".aras-grid-row-cell") || doc.querySelector(".aras-grid-head") || w.grid;
    if (!hasGrid) return false;

    injectStyles(doc);
    formatGridRowsSafely(w);
    attachSearchInputSafely(w);

    if (!doc._bcsObserverBound && doc.body) {
      doc._bcsObserverBound = true;
      const obs = new MutationObserver(function () {
        formatGridRowsSafely(w);
        attachSearchInputSafely(w);
      });
      obs.observe(doc.body, { childList: true, subtree: true });
    }

    return true;
  }

  // 13. 全域啟動與套用
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

  console.log("[bcs_label_grid] 掃描完成，已對 " + enhancedGridCount + " 個 Grid 畫面完成彩化與方案 A 搜尋卡片掛載！");

  // 若由 Action 點擊觸發，彈出成功提示
  if (arasObj && typeof arasObj.AlertSuccess === "function") {
    arasObj.AlertSuccess("標記彩化與方案 A 搜尋選擇器已成功啟用！已套用至 " + enhancedGridCount + " 個視窗。");
  }

  // 在頂層 window.top 啟動全域守護定時器 (確保切換分頁或新開搜尋時持續生效)
  const topWin = window.top || window;
  if (!topWin._bcs_global_grid_daemon) {
    topWin._bcs_global_grid_daemon = setInterval(function () {
      const currentFrames = getAllFrames(topWin);
      for (let k = 0; k < currentFrames.length; k++) {
        try {
          enhanceWindow(currentFrames[k]);
        } catch (errDaemon) {}
      }
    }, 1500);
  }
})();
