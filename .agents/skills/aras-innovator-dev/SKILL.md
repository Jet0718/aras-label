---
name: aras-innovator-dev
description: Aras Innovator 企業級開發指引與語法防護技能，涵蓋 Client Method (Monaco/TypeScript linter 警告消除、Grid DOM 防裁切)、Server Method (C# Method Wrapper、AML 轉譯)、AML 模型宣告與權限配置。
---

# Aras Innovator 企業級開發與語法防護技能 (SKILL.md)

本 Skill 專門用於指導開發者與 AI 代理在 **Aras Innovator** 平台（特別是 R12 / R2023 / R36+）進行前端 Client Method、後端 Server Method 與 AML 模型配置時，精準避免所有已知語法陷阱與平台限制。

## 核心知識體系

### 1. Client Method (JavaScript) 零錯誤規範
- **參數預設值守則 (Anti-Implicit-Any)**：
  Aras Monaco Editor 啟用 `noImplicitAny`。純 JS 函式所有參數必須給予明確預設值（例如 `targetDoc = null`, `hexColor = ""`）。
- **註解風格守則 (Anti-TS80001)**：
  嚴禁在純 JS 中撰寫 TypeScript `: Type` 語法，亦不要在 JSDoc 中使用 `{Type}` 花括號，改用標準中文行註解說明參數，防止觸發 `JSDoc types may be moved to TypeScript types` 提示。
- **零未使用變數守則 (Anti-TS6133)**：
  Aras Monaco Editor 啟用 `noUnusedLocals`。禁止解構出未讀取的變數（例如 Map 遍歷若僅取用 value，改用 `for (const val of map.values())`）；嚴禁宣告僅賦值但未被讀取的冗餘旗標變數。
- **Grid DOM 防裁切原則**：
  主網格（HyperGrid）搜尋列具備虛擬滾動與重繪機制，浮層（Popover/Modal）必須掛載於 `document.body`，採用 `position: fixed` + `z-index: 999999`，動態計算座標。
- **三重容錯欄位偵測**：
  表頭文字包含比對 -> DOM 屬性 (`data-key`/`data-index`) -> 資料列已彩化特徵比對。

### 2. Server Method (C# .NET) 規範
- **Method Wrapper 機制**：
  Aras 伺服器會將代碼自動包裝於 `ItemMethod.methodCode()`。禁止撰寫頂層 `using` 或 `namespace`，使用型別時帶完整命名空間（如 `System.Xml.XmlDocument`）。
- **全路徑回傳保證**：
  所有程式碼分支（含 catch 例外）必須顯式返回 `Item`（`return this;` 或 `return inn.newError(...)`）。
- **防注入安全轉義**：
  所有外部輸入字串在拼接進 AML 或 SQL 之前，必須執行 `term.Replace("'", "''")`。

### 3. AML 架構與權限配置規範
- **ID 產生原則**：建立 ItemType 或實例時，禁止自訂非標準字串 ID，由 Aras 核心自動分配 32 碼 Hex GUID。
- **RelationshipType 嵌套**：建立關聯表時，關聯 ItemType 需直接嵌套於 `<relationship_id>` 內一併建立。
- **權限必配原則**：建立 ItemType 必須包含 `Allowed Permission` (`is_default=1`) 與 `ItemType Can Add`。
