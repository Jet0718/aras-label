/**
 * @file SearchTranslator.test.js
 * @description 搜尋條件解析與匹配轉譯單元測試
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const SearchCriteriaTranslator = require("../../src/search/SearchCriteriaTranslator");

describe("SearchCriteriaTranslator Tests", () => {
  it("應能正確解析單一與多個標籤關鍵字，並去除萬用字元與空白", () => {
    const raw1 = "*緊急處理*";
    assert.deepStrictEqual(SearchCriteriaTranslator.parseTerms(raw1), ["緊急處理"]);

    const raw2 = "*緊急處理, VIP重點; 設計審查*";
    assert.deepStrictEqual(SearchCriteriaTranslator.parseTerms(raw2), ["緊急處理", "VIP重點", "設計審查"]);

    const raw3 = "urgent;vip";
    assert.deepStrictEqual(SearchCriteriaTranslator.parseTerms(raw3), ["urgent", "vip"]);
  });

  it("應能產生正確的 JSON LIKE 模式字串", () => {
    assert.strictEqual(SearchCriteriaTranslator.buildJsonLikePattern("urgent"), '%"name":"urgent"%');
  });

  it("單一標籤時應生成簡潔 AML 節點", () => {
    const aml = SearchCriteriaTranslator.buildAML("labels", ["urgent"]);
    assert.strictEqual(aml, '<labels condition="like">%"name":"urgent"%</labels>');
  });

  it("多標籤時應生成標準 <and> 區塊的 AML 節點", () => {
    const aml = SearchCriteriaTranslator.buildAML("labels", ["urgent", "vip"], "AND");
    assert.match(aml, /<and>/);
    assert.match(aml, /<labels condition="like">%"name":"urgent"%<\/labels>/);
    assert.match(aml, /<labels condition="like">%"name":"vip"%<\/labels>/);
    assert.match(aml, /<\/and>/);
  });

  it("matchesRecord: 應能精確判斷包含單一標籤的項目", () => {
    const recordJson = JSON.stringify([
      { name: "urgent", label: "緊急處理", color: "#EF4444" },
      { name: "design", label: "設計階段", color: "#3B82F6" }
    ]);

    // 以中文名稱比對
    assert.strictEqual(SearchCriteriaTranslator.matchesRecord(recordJson, ["緊急處理"]), true);
    // 以代碼比對
    assert.strictEqual(SearchCriteriaTranslator.matchesRecord(recordJson, ["urgent"]), true);
    // 未包含的標籤
    assert.strictEqual(SearchCriteriaTranslator.matchesRecord(recordJson, ["VIP客戶"]), false);
  });

  it("matchesRecord: 多標籤 AND 模式下，必須同時包含全部標籤才命中", () => {
    const recordJson = JSON.stringify([
      { name: "urgent", label: "緊急處理", color: "#EF4444" },
      { name: "design", label: "設計階段", color: "#3B82F6" }
    ]);

    // 同時有 urgent 與 design -> 符合
    assert.strictEqual(SearchCriteriaTranslator.matchesRecord(recordJson, ["緊急處理", "設計階段"], "AND"), true);
    // 有 urgent 但沒有 vip -> 不符合
    assert.strictEqual(SearchCriteriaTranslator.matchesRecord(recordJson, ["緊急處理", "VIP重點"], "AND"), false);
  });

  it("matchesRecord: 應支援多語系 labels 字典中之文字模糊匹配", () => {
    const recordJson = JSON.stringify([
      {
        name: "urgent",
        label: "緊急處理",
        labels: { "zh-TW": "緊急處理", "en": "Urgent Action" },
        color: "#EF4444"
      }
    ]);

    // 以英文查詢
    assert.strictEqual(SearchCriteriaTranslator.matchesRecord(recordJson, ["Urgent"]), true);
    assert.strictEqual(SearchCriteriaTranslator.matchesRecord(recordJson, ["Urgent Action"]), true);
  });

  it("防誤查驗證：搜尋「VIP重點」時，僅含有「緊急處理/設計審查」之紀錄絕不命中", () => {
    // 模擬 AM-1 (緊急處理 + 設計審查)
    const am1Json = JSON.stringify([
      { name: "urgent", label: "緊急處理", labels: { "zh-TW": "緊急處理", "en": "Urgent Action" }, color: "#EF4444" },
      { name: "design", label: "設計審查", labels: { "zh-TW": "設計審查", "en": "Design Review" }, color: "#3B82F6" }
    ]);
    // 模擬 AM-7 (僅有 緊急處理)
    const am7Json = JSON.stringify([
      { name: "urgent", label: "緊急處理", labels: { "zh-TW": "緊急處理", "en": "Urgent Action" }, color: "#EF4444" }
    ]);
    // 模擬 AM-3 (含有 VIP重點)
    const am3Json = JSON.stringify([
      { name: "vip", label: "VIP重點", labels: { "zh-TW": "VIP重點", "en": "VIP Focus" }, color: "#8B5CF6" }
    ]);

    // 搜尋 VIP重點
    const searchTerms = ["VIP重點"];
    assert.strictEqual(SearchCriteriaTranslator.matchesRecord(am1Json, searchTerms), false, "AM-1 不應命中 VIP重點");
    assert.strictEqual(SearchCriteriaTranslator.matchesRecord(am7Json, searchTerms), false, "AM-7 不應命中 VIP重點");
    assert.strictEqual(SearchCriteriaTranslator.matchesRecord(am3Json, searchTerms), true, "AM-3 必須正確命中 VIP重點");
  });
});
