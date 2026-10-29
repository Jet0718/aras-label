/**
 * @file GridVirtualDomSafety.test.js
 * @description 驗證 Aras Innovator HyperGrid (Inferno.js) Virtual DOM 零破壞安全渲染與純淨 TextNode 防污染邏輯
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");

describe("Grid Virtual DOM Safety & Anti-Misplacement Tests", () => {
  // 提取純淨原生文字 (與 bcs_main_grid_extension.js 的 extractRawJsonText 一致)
  function extractRawJsonText(cellEl) {
    if (!cellEl) return "";
    let raw = "";
    const children = cellEl.childNodes || cellEl.children || [];
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (node.nodeType === 3 || node.type === "text") {
        raw += node.nodeValue || node.value || "";
      } else if (node.nodeType === 1 || node.className) {
        if (!node.className.includes("bcs-grid-tags-cell") && !node.className.includes("bcs-grid-tag-badge")) {
          raw += node.textContent || node.value || "";
        }
      }
    }
    return raw.trim();
  }

  // 模擬安全單元格格式化邏輯
  function simulateSafeFormat(cellEl, isLabelsColumn) {
    if (!isLabelsColumn) {
      const existing = cellEl.querySelector(".bcs-grid-tags-cell");
      if (existing) existing.remove();
      cellEl.classList.remove("bcs-labels-cell-active");
      return;
    }

    const text = extractRawJsonText(cellEl);
    if (!text.startsWith("[") || !text.includes('"name":')) {
      const existing = cellEl.querySelector(".bcs-grid-tags-cell");
      if (existing) existing.remove();
      cellEl.classList.remove("bcs-labels-cell-active");
      return;
    }

    cellEl.classList.add("bcs-labels-cell-active");
    let container = cellEl.querySelector(".bcs-grid-tags-cell");
    if (!container) {
      container = {
        className: "bcs-grid-tags-cell",
        children: [],
        dataset: {},
        remove() {
          const idx = cellEl.children.indexOf(this);
          if (idx >= 0) cellEl.children.splice(idx, 1);
        }
      };
      cellEl.children.push(container);
    }

    const tags = JSON.parse(text);
    const currentKeys = tags.map((t) => t.name).join(",");
    if (container.dataset.bcsTagsKey === currentKeys) {
      return;
    }
    container.dataset.bcsTagsKey = currentKeys;
    container.children = tags.map((t) => ({ name: t.name, label: t.label, color: t.color }));
  }

  it("防錯位驗證：當單元格非 labels 欄位時 (如 State)，絕不可被彩化，且應清理殘留徽章", () => {
    const mockCell = {
      children: [
        { type: "text", value: "Preliminary" }
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

    simulateSafeFormat(mockCell, false);

    assert.strictEqual(mockCell.querySelector(".bcs-grid-tags-cell"), null, "State 欄位中的殘留徽章必須被安全移除");
    assert.strictEqual(mockCell.classList.contains("bcs-labels-cell-active"), false, "State 欄位不得被標記為標籤激活狀態");
    assert.strictEqual(mockCell.children[0].value, "Preliminary", "原生文字節點 Preliminary 必須完好保留");
  });

  it("反覆搜尋切換驗證：從 AM-1 (緊急處理) 切換至 AM-3 (VIP重點) 時，標籤必須即時精確更新為 VIP重點", () => {
    // 1. 初始狀態：渲染 AM-1 (緊急處理, 設計審查)
    const textNode = {
      type: "text",
      value: JSON.stringify([
        { name: "urgent", label: "緊急處理", color: "#EF4444" },
        { name: "design", label: "設計審查", color: "#3B82F6" }
      ])
    };

    const cell = {
      children: [textNode],
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

    // 第一次渲染
    simulateSafeFormat(cell, true);
    let container = cell.querySelector(".bcs-grid-tags-cell");
    assert.strictEqual(container.children.length, 2);
    assert.strictEqual(container.children[0].label, "緊急處理");
    assert.strictEqual(container.children[1].label, "設計審查");

    // 2. 使用者切換條件搜尋「VIP重點」，Virtual DOM 將單元格 TextNode 更新為 AM-3
    textNode.value = JSON.stringify([
      { name: "vip", label: "VIP重點", color: "#8B5CF6" }
    ]);

    // 第二次渲染：此時單元格內已帶有 container (先前殘留緊急處理)
    simulateSafeFormat(cell, true);

    // 驗證：container 必須成功重繪，且標籤必須為 VIP重點！絕不卡死在「緊急處理/設計審查」！
    container = cell.querySelector(".bcs-grid-tags-cell");
    assert.strictEqual(container.children.length, 1, "徽章數量必須更新為 1 個");
    assert.strictEqual(container.children[0].name, "vip", "標籤代碼必須為 vip");
    assert.strictEqual(container.children[0].label, "VIP重點", "標籤顯示文字必須為 VIP重點");
    assert.strictEqual(container.dataset.bcsTagsKey, "vip", "快取鍵值必須更新為 vip");
  });
});
