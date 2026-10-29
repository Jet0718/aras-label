# Aras Innovator R36 - Client Form Multi-Label 專案規範與指引 (gemini.md)

## 專案範疇
本專案為 **Aras Innovator R36** 前端表單擴充元件，提供「多標籤（Multi-Label/Chips）選擇與管理」之 Client Form Field 功能。

## 架構分層與責任界定
- **`src/core/LabelStore.js`**：負責標籤集合的狀態管理、格式序列化與反序列化（純邏輯，無 DOM、無 Aras 依賴）。
- **`src/core/LabelRenderer.js`**：負責 DOM 渲染、CSS 樣式管理與互動事件綁定。
- **`src/adapter/ArasAdapter.js`**：封裝 Aras Innovator Web Client API (`handleItemChange`, `document.item`, `document.isEditMode`)。
- **`src/controller/MultiLabelController.js`**：協調整合 Store、Renderer 與 Adapter。
- **`src/styles/label-widget.css`**：現代化視覺樣式。
- **`src/aras/Form_MultiLabel_Field.html`**：可直接貼入或匯入 Aras Innovator Form HTML Field 的一體化組件檔案。

## 程式規範與原則
1. **S.O.L.I.D 原則**：嚴格遵循單一職責、開放封閉與依賴注入。
2. **註解語言**：所有類別與函式皆採用中文註解，標註參數型別與功能說明。
3. **測試優先**：核心邏輯須具備單元測試，全域驗證須配合瀏覽器 e2e 測試。
4. **版本控管**：任務完成後提交 commit，必要時使用 gh CLI 建立儲存庫。

## 5. Aras Innovator 避坑守則與語法防護 (重要知識沉澱)
- **Client Method 語法防護**：
  1. 所有函式與回調參數必須提供預設值（如 `targetDoc = null`），杜絕 Monaco `noImplicitAny` 警告。
  2. 嚴禁在純 JS 中撰寫 TypeScript 語法，禁止在 JSDoc 中使用 `{Type}` 花括號，改用標準中文行註解，杜絕 `TS80001` 提示。
  3. 主網格搜尋浮層採非侵入式結構，浮層掛載於 `document.body` 採 `position: fixed` 防裁切。
- **Server Method 語法防護**：
  1. 嚴禁頂層 `using` 與 `namespace`，使用型別時帶完整命名空間。
  2. 所有分支路徑（含 catch）必須顯式返回 `Item`。
  3. 外部輸入拼接進 AML/SQL 前必須執行 `term.Replace("'", "''")`。
- **完整知識庫參考**：請查閱 `.agents/rules/aras_development_rules.md` 與技能 `.agents/skills/aras-innovator-dev/SKILL.md`。
