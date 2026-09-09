/**
 * @file LabelTag.test.js
 * @description LabelTag 實體模型單元測試，包含多語系 (I18N) 解析與 Fallback 驗證
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const LabelTag = require("../../src/models/LabelTag");

describe("LabelTag Model Tests", () => {
  it("應正確初始化標準屬性與預設值", () => {
    const tag = new LabelTag("urgent", "緊急處理", "#EF4444", 1.5);
    assert.strictEqual(tag.name, "urgent");
    assert.strictEqual(tag.label, "緊急處理");
    assert.strictEqual(tag.color, "#EF4444");
    assert.strictEqual(tag.sort_id, 1.5);
  });

  it("若未提供 label 應以 name 作為預設顯示名稱", () => {
    const tag = new LabelTag("review", null, "#10B981");
    assert.strictEqual(tag.name, "review");
    assert.strictEqual(tag.label, "review");
  });

  it("若未提供有效的 name 應拋出錯誤", () => {
    assert.throws(() => new LabelTag("", "標籤"), /LabelTag 必須具備有效的 name 字串鍵值/);
    assert.throws(() => new LabelTag(null, "標籤"), /LabelTag 必須具備有效的 name 字串鍵值/);
  });

  it("應自動標準化 3 碼十六進制顏色為 6 碼大寫", () => {
    const tag = new LabelTag("test", "測試", "#f00");
    assert.strictEqual(tag.color, "#FF0000");
  });

  it("若傳入無效顏色格式應回退為預設藍色 (#3B82F6)", () => {
    const tag = new LabelTag("test", "測試", "invalid_color");
    assert.strictEqual(tag.color, "#3B82F6");
  });

  it("應準確計算高對比文字顏色 (深底配白字，淺底配深字)", () => {
    const darkTag = new LabelTag("dark", "深色", "#1E293B");
    assert.strictEqual(darkTag.getContrastTextColor(), "#FFFFFF");

    const lightTag = new LabelTag("light", "淺色", "#FEF08A");
    assert.strictEqual(lightTag.getContrastTextColor(), "#1F2937");
  });

  it("多語系解析：應能依據語系精確返回指定文字 (zh-TW, en, zh-CN)", () => {
    const tag = new LabelTag("urgent", "緊急", "#EF4444", 1, {
      "zh-TW": "繁體緊急",
      "zh-CN": "简体紧急",
      "en": "Urgent Action"
    });

    assert.strictEqual(tag.getDisplayLabel("zh-TW"), "繁體緊急");
    assert.strictEqual(tag.getDisplayLabel("en"), "Urgent Action");
    assert.strictEqual(tag.getDisplayLabel("zh-CN"), "简体紧急");
  });

  it("多語系解析：若無該語系，應依序 Fallback (baseLang -> default -> en -> name)", () => {
    // 案例 1: 查詢 zh-HK，無精準比對但有 zh
    const tag1 = new LabelTag("design", "設計", "#3B82F6", 2, {
      "zh": "中文設計",
      "en": "Design"
    });
    assert.strictEqual(tag1.getDisplayLabel("zh-HK"), "中文設計");

    // 案例 2: 查詢 ja (日語)，字典無 ja，應退回 en 或 default
    const tag2 = new LabelTag("review", "審核中", "#10B981", 3, {
      "zh-TW": "審核中",
      "en": "In Review"
    });
    assert.strictEqual(tag2.getDisplayLabel("ja"), "In Review");

    // 案例 3: 完全沒有字典時，應安全退回預設 label
    const tag3 = new LabelTag("custom", "自訂標籤", "#8B5CF6", 4, {});
    assert.strictEqual(tag3.getDisplayLabel("de"), "自訂標籤");
  });

  it("toJSON 與 fromJSON 應能完整保存與還原多語系字典", () => {
    const origin = new LabelTag("vip", "VIP客戶", "#8B5CF6", 2, {
      "zh-TW": "VIP 客戶",
      "en": "VIP Customer"
    });
    const json = origin.toJSON();
    const restored = LabelTag.fromJSON(json);

    assert.strictEqual(restored.name, origin.name);
    assert.strictEqual(restored.getDisplayLabel("zh-TW"), "VIP 客戶");
    assert.strictEqual(restored.getDisplayLabel("en"), "VIP Customer");
    assert.strictEqual(restored.color, origin.color);
    assert.strictEqual(restored.sort_id, origin.sort_id);
  });
});
