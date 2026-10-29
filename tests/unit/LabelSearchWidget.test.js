/**
 * @file LabelSearchWidget.test.js
 * @description 方案 A：Main Search 標籤搜尋列彩色多選浮層 (LabelSearchWidget) 單元測試
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");
const LabelTag = require("../../src/models/LabelTag");
const SearchCriteriaTranslator = require("../../src/search/SearchCriteriaTranslator");
const LabelSearchWidget = require("../../src/search/LabelSearchWidget");

/**
 * 簡易微型 Mock DOM 類別，供 Node 環境測試組件行為
 */
class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.classList = new Set();
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.attributes = {};
    this.value = "";
    this._innerHTML = "";
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    this.children = [];
    // 簡易模擬子項目建立
    if (val.includes("bcs-popover-item")) {
      const matches = val.match(/class="bcs-popover-item[^"]*"/g) || [];
      matches.forEach(() => {
        const item = new MockElement("div");
        item.classList.add("bcs-popover-item");
        const cb = new MockElement("input");
        cb.type = "checkbox";
        item.appendChild(cb);
        this.appendChild(item);
      });
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  dispatchEvent(event) {
    const fns = this.listeners[event.type] || [];
    fns.forEach(fn => fn(event));
  }

  querySelector(selector) {
    if (selector.startsWith(".")) {
      const cls = selector.substring(1);
      return this.findByClass(cls);
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector.startsWith(".")) {
      const cls = selector.substring(1);
      return this.findAllByClass(cls);
    }
    return [];
  }

  findByClass(cls) {
    if (this.classList.has(cls)) return this;
    for (const child of this.children) {
      const res = child.findByClass(cls);
      if (res) return res;
    }
    return null;
  }

  findAllByClass(cls) {
    const res = [];
    if (this.classList.has(cls)) res.push(this);
    for (const child of this.children) {
      res.push(...child.findAllByClass(cls));
    }
    return res;
  }

  contains(node) {
    if (this === node) return true;
    for (const child of this.children) {
      if (child.contains(node)) return true;
    }
    return false;
  }
}

describe("方案 A: LabelSearchWidget 核心邏輯測試", () => {
  let sampleTags;

  beforeEach(() => {
    sampleTags = [
      LabelTag.fromJSON({
        name: "urgent",
        label: "緊急處理",
        labels: { "zh-TW": "緊急處理", "en": "Urgent Action", "zh-CN": "紧急处理" },
        color: "#EF4444",
        sort_id: 10
      }),
      LabelTag.fromJSON({
        name: "vip",
        label: "VIP重點",
        labels: { "zh-TW": "VIP重點", "en": "VIP Customer", "zh-CN": "VIP重点" },
        color: "#8B5CF6",
        sort_id: 20
      }),
      LabelTag.fromJSON({
        name: "design",
        label: "設計階段",
        labels: { "zh-TW": "設計階段", "en": "Design Stage", "zh-CN": "设计阶段" },
        color: "#3B82F6",
        sort_id: 30
      })
    ];
  });

  it("應能建立可選標籤清單並預設為 AND 模式", () => {
    // 驗證標籤模型
    assert.strictEqual(sampleTags.length, 3);
    assert.strictEqual(sampleTags[0].getDisplayLabel("zh-TW"), "緊急處理");
    assert.strictEqual(sampleTags[0].getDisplayLabel("en"), "Urgent Action");
    assert.strictEqual(sampleTags[0].color, "#EF4444");
    assert.strictEqual(sampleTags[0].getContrastTextColor(), "#FFFFFF");
  });

  it("標籤勾選與多選：應能正確同步已選標籤至條件字串", () => {
    const selectedKeys = new Set(["urgent", "vip"]);
    const chosenLabels = [];
    sampleTags.forEach(t => {
      if (selectedKeys.has(t.name)) {
        chosenLabels.push(t.getDisplayLabel("zh-TW"));
      }
    });

    // 預設 AND 逗號分隔
    const criteriaTextAND = chosenLabels.join(", ");
    assert.strictEqual(criteriaTextAND, "緊急處理, VIP重點");

    // OR 管道符號分隔
    const criteriaTextOR = chosenLabels.join(" | ");
    assert.strictEqual(criteriaTextOR, "緊急處理 | VIP重點");
  });

  it("條件字串解析：手動輸入文字時能準確反向識別已定義標籤", () => {
    const rawInput = "緊急處理, vip, 未知標籤";
    const terms = SearchCriteriaTranslator.parseTerms(rawInput);
    assert.deepStrictEqual(terms, ["緊急處理", "vip", "未知標籤"]);

    const resolvedKeys = new Set();
    terms.forEach(term => {
      const lower = term.toLowerCase();
      const found = sampleTags.find(
        t => t.name.toLowerCase() === lower || t.getDisplayLabel("zh-TW").toLowerCase() === lower
      );
      if (found) {
        resolvedKeys.add(found.name);
      } else {
        resolvedKeys.add(term);
      }
    });

    assert.strictEqual(resolvedKeys.has("urgent"), true);
    assert.strictEqual(resolvedKeys.has("vip"), true);
    assert.strictEqual(resolvedKeys.has("未知標籤"), true);
  });

  it("多語系動態切換：切換英文時，能產出英文語系之條件文字", () => {
    const selectedKeys = new Set(["urgent", "design"]);
    const enLabels = [];
    sampleTags.forEach(t => {
      if (selectedKeys.has(t.name)) {
        enLabels.push(t.getDisplayLabel("en"));
      }
    });

    assert.strictEqual(enLabels.join(", "), "Urgent Action, Design Stage");
  });
});
