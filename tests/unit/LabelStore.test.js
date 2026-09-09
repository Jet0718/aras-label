/**
 * @file LabelStore.test.js
 * @description LabelStore 標籤集合狀態管理單元測試
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const LabelStore = require("../../src/core/LabelStore");
const LabelTag = require("../../src/models/LabelTag");

describe("LabelStore Core Tests", () => {
  it("應能正常新增標籤並防範重複標籤 (不分大小寫)", () => {
    const store = new LabelStore();
    const tag1 = new LabelTag("urgent", "緊急", "#EF4444", 1);
    const tag2 = new LabelTag("URGENT", "重複緊急", "#EF4444", 1);
    const tag3 = new LabelTag("design", "設計", "#3B82F6", 2);

    assert.strictEqual(store.add(tag1), true);
    assert.strictEqual(store.add(tag2), false); // 重複不加入
    assert.strictEqual(store.add(tag3), true);
    assert.strictEqual(store.getAll().length, 2);
  });

  it("應能依據 sort_id 自動進行升冪排序", () => {
    const store = new LabelStore();
    store.add(new LabelTag("tag3", "第三", "#10B981", 30));
    store.add(new LabelTag("tag1", "第一", "#EF4444", 10));
    store.add(new LabelTag("tag2", "第二", "#3B82F6", 20));

    const all = store.getAll();
    assert.strictEqual(all[0].name, "tag1");
    assert.strictEqual(all[1].name, "tag2");
    assert.strictEqual(all[2].name, "tag3");
  });

  it("應能依據 name 鍵值成功移除標籤", () => {
    const store = new LabelStore();
    store.add(new LabelTag("tag1", "第一", "#EF4444"));
    store.add(new LabelTag("tag2", "第二", "#3B82F6"));

    assert.strictEqual(store.removeByName("tag1"), true);
    assert.strictEqual(store.removeByName("non_exist"), false);
    assert.strictEqual(store.getAll().length, 1);
    assert.strictEqual(store.has("tag1"), false);
  });

  it("應能依據陣列索引成功移除標籤", () => {
    const store = new LabelStore();
    store.add(new LabelTag("tag1", "第一", "#EF4444"));
    store.add(new LabelTag("tag2", "第二", "#3B82F6"));

    assert.strictEqual(store.removeAt(0), true);
    assert.strictEqual(store.removeAt(99), false);
    assert.strictEqual(store.getAll().length, 1);
  });

  it("應能正確序列化為 JSON 陣列字串", () => {
    const store = new LabelStore();
    store.add(new LabelTag("urgent", "緊急", "#EF4444", 1));
    store.add(new LabelTag("review", "審核", "#10B981", 2));

    const jsonStr = store.serializeJSON();
    const parsed = JSON.parse(jsonStr);

    assert.strictEqual(Array.isArray(parsed), true);
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].name, "urgent");
    assert.strictEqual(parsed[1].name, "review");
  });

  it("應能從合法 JSON 字串反序列化並載入標籤", () => {
    const store = new LabelStore();
    const rawJson = JSON.stringify([
      { name: "tagA", label: "標籤A", color: "#6366F1", sort_id: 1 },
      { name: "tagB", label: "標籤B", color: "#EC4899", sort_id: 2 }
    ]);

    store.deserializeJSON(rawJson);
    assert.strictEqual(store.getAll().length, 2);
    assert.strictEqual(store.getAll()[0].name, "tagA");
    assert.strictEqual(store.getAll()[1].label, "標籤B");
  });

  it("反序列化異常格式或空值時應安全降級為空清單，不應噴錯中斷", () => {
    const store = new LabelStore();
    store.deserializeJSON("invalid_json_string{");
    assert.strictEqual(store.getAll().length, 0);

    store.deserializeJSON(null);
    assert.strictEqual(store.getAll().length, 0);
  });
});
