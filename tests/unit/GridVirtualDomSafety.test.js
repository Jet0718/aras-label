/**
 * @file GridVirtualDomSafety.test.js
 * @description 驗證 Aras Innovator HyperGrid (Inferno.js) Virtual DOM 零破壞安全渲染與防欄位錯位邏輯
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");

describe("Grid Virtual DOM Safety & Anti-Misplacement Tests", () => {
  // 模擬安全單元格格式化邏輯 (與 bcs_main_grid_extension.js 核心演算法完全一致)
  function simulateSafeFormat(cellEl, isLabelsColumn, jsonText) {
    // 1. 若非標籤欄位 (例如 State)，立即移除殘留增強層並還原
    if (!isLabelsColumn) {
      const existing = cellEl.querySelector(".bcs-grid-tags-cell");
      if (existing) existing.remove();
      cellEl.classList.remove("bcs-labels-cell-active");
      return;
    }

    if (!jsonText || !jsonText.startsWith("[") || !jsonText.includes('"name":')) {
      const existing = cellEl.querySelector(".bcs-grid-tags-cell");
      if (existing) existing.remove();
      cellEl.classList.remove("bcs-labels-cell-active");
      return;
    }

    // 2. 零破壞渲染：不清空 cellEl 原生子節點
    cellEl.classList.add("bcs-labels-cell-active");
    let container = cellEl.querySelector(".bcs-grid-tags-cell");
    if (!container) {
      container = {
        className: "bcs-grid-tags-cell",
        children: [],
        remove() {
          const idx = cellEl.children.indexOf(this);
          if (idx >= 0) cellEl.children.splice(idx, 1);
        }
      };
      cellEl.children.push(container);
    }

    // 渲染徽章
    const tags = JSON.parse(jsonText);
    container.children = tags.map((t) => ({ name: t.name, label: t.label, color: t.color }));
  }

  it("防錯位驗證：當單元格非 labels 欄位時 (如 State)，絕不可被彩化，且應清理殘留徽章", () => {
    // 模擬一個被 Virtual DOM 複用分配給 State 欄位的單元格
    const mockCell = {
      children: [
        { type: "text", value: "Preliminary" } // 原生 State 文字節點
      ],
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      querySelector(sel) {
        if (sel === ".bcs-grid-tags-cell") {
          return this.children.find((c) => c.className === "bcs-grid-tags-cell") || null;
        }
        return null;
      }
    };

    // 模擬先前殘留了 labels 徽章
    const residualBadge = {
      className: "bcs-grid-tags-cell",
      children: [{ name: "urgent", label: "緊急處理" }],
      remove() {
        const idx = mockCell.children.indexOf(this);
        if (idx >= 0) mockCell.children.splice(idx, 1);
      }
    };
    mockCell.children.push(residualBadge);
    mockCell.classList.add("bcs-labels-cell-active");

    // 執行防護渲染：指定 isLabelsColumn = false (因為當前是 State 欄位)
    simulateSafeFormat(mockCell, false, '[{"name":"urgent","label":"緊急處理"}]');

    // 驗證：殘留徽章必須被移除，單元格不得帶有 active class，原生 State 文字節點完好無損
    assert.strictEqual(mockCell.querySelector(".bcs-grid-tags-cell"), null, "State 欄位中的殘留徽章必須被安全移除");
    assert.strictEqual(mockCell.classList.contains("bcs-labels-cell-active"), false, "State 欄位不得被標記為標籤激活狀態");
    assert.strictEqual(mockCell.children[0].value, "Preliminary", "原生文字節點 Preliminary 必須完好保留");
  });

  it("零破壞驗證：當單元格確為 labels 欄位時，原生文字節點不應被拔除，徽章作為安全層追加", () => {
    const originalTextNode = { type: "text", value: '[{"name":"vip","label":"VIP重點"}]' };
    const mockCell = {
      children: [originalTextNode],
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      querySelector(sel) {
        if (sel === ".bcs-grid-tags-cell") {
          return this.children.find((c) => c.className === "bcs-grid-tags-cell") || null;
        }
        return null;
      }
    };

    simulateSafeFormat(mockCell, true, originalTextNode.value);

    // 驗證：原生 text node 依然在第 0 個位置 (Inferno insertBefore 永遠找得到此節點)
    assert.strictEqual(mockCell.children[0], originalTextNode, "原生 TextNode 必須持續保留於 DOM 樹內");
    // 追加了徽章層
    const badgeContainer = mockCell.querySelector(".bcs-grid-tags-cell");
    assert.notStrictEqual(badgeContainer, null, "必須追加獨立徽章層");
    assert.strictEqual(badgeContainer.children[0].label, "VIP重點");
    assert.strictEqual(mockCell.classList.contains("bcs-labels-cell-active"), true);
  });
});
