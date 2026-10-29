# Aras Innovator R36 - Client 端前端擴充規範 (gemini.md)

## 領域範疇
本領域涵蓋 Aras Innovator Web Client 端之表單元件 (Form Field)、主搜尋網格 (Main Search Grid) 擴充、彩色徽章渲染器、標籤挑選浮層 (Popover Widget) 與適配器 (Adapters)。

## 架構分層與責任界定 (S.O.L.I.D 原則)
1. **實體模型層 (`src/models/LabelTag.js`)**
   - 封裝單一標籤資料模型 (`name`, `label`, `labels`, `color`, `sort_id`)。
   - 提供多語系解析 (`getDisplayLabel`) 與色彩對比計算 (`getContrastTextColor`)。
2. **狀態管理層 (`src/core/LabelStore.js`)**
   - 維護標籤集合的選取狀態、新增、刪除與重複性校驗。
   - 與 DOM 完全解耦，支援純邏輯單元測試。
3. **視圖渲染層 (`src/core/LabelRenderer.js`, `src/search/GridCellFormatter.js`)**
   - 負責 Form 與 Grid 單元格的 DOM 建立、樣式套用與事件委派。
   - 不破壞 Aras 原生 DOM 結構，避免非預期的版面跑版。
4. **搜尋控制層 (`src/search/LabelSearchWidget.js`, `src/aras/client/bcs_main_grid_extension.js`)**
   - 實現 Main Search 標籤搜尋列之「彩色多選浮層 (Popover)」元件。
   - 負責欄位探測、浮層定位、AND/OR 切換與觸發 Aras 主搜尋。
5. **平台適配層 (`src/adapter/ArasAdapter.js`)**
   - 隔離 Aras Client 全域物件 (`aras`, `arasObj`, `document.item`)，便於測試與相容性維護。

## 開發規範與約定
1. **DOM 防破壞原則**：在擴充 Aras HyperGrid / Search Row 時，嚴禁置換或移除原生 `<input>`，採非侵入式（Overlay / Sibling 定位 / 事件攔截）掛載。
2. **多語系支持**：所有標籤與 UI 文字皆需相容繁體中文 (`zh-TW`)、簡體中文 (`zh-CN`) 與英文 (`en`)，支援 Fallback 機制。
3. **函式與註解規範**：所有類別與函式均需提供中文註解，詳細說明參數 (Param)、回傳值 (Return) 與異常處理。
4. **單元測試與驗證**：核心組件需具備 Jest / Mocha 單元測試覆蓋，上線前執行瀏覽器端 E2E 模擬測試。
5. **Monaco Linter 避坑守則**：
   - 參數一律設置安全預設值（如 `targetDoc = null`），避免觸發 `implicitly has an 'any' type`。
   - 嚴禁在純 JS 中撰寫 TypeScript 語法，禁止在 JSDoc 中使用 `{Type}` 花括號，改用標準中文行註解，避免觸發 `JSDoc types may be moved to TypeScript types (TS80001)` 提示。
