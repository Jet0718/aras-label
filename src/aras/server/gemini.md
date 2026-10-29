# Aras Innovator R36 - Server 端後端方法規範 (gemini.md)

## 領域範疇
本領域涵蓋 Aras Innovator 伺服器端 Method (C# .NET) 與 AML 宣告定義，核心包含 `bcs_label_search_handler` (掛載於 ItemType 之 `onBeforeGet` 事件)。

## 核心職責與設計 (S.O.L.I.D 原則)
1. **單一職責 (Single Responsibility)**
   - 負責攔截與解析目標 ItemType (如 `Part`) 針對多標籤欄位 (`labels`) 之查詢請求 (AML)。
   - 負責查詢 `bcs_label_tags` 標籤目錄，將使用者輸入之標籤名稱/多語系標籤對齊轉換為唯一識別碼 (Key)。
   - 負責重寫查詢 criteria 為高效率之 JSON 子字串 SQL 匹配 (`%"name":"key"%`)。
2. **開閉原則 (Open/Closed)**
   - 預設提供 AND 交集匹配，並預留擴充支援 OR 模式或複雜組合運算式之接口。
3. **介面隔離與依賴反向**
   - 透過標準 `Innovator` 與 `Item` API 與 Aras 核心通訊，不直接依賴底層特定資料庫廠商之專屬 SQL 語法。

## 程式碼撰寫與安全性規範
1. **Aras Method Wrapper 規範**：
   - 程式碼直接在方法體中執行，嚴禁包含頂層 `using` 或 `namespace` 定義。
   - 所有分支流程（含例外捕捉）必須顯式返回 `Item` 物件。
2. **防注入規範 (Anti-Injection)**：
   - 使用者輸入之標籤文字必須進行單引號字元轉義處理 (`Replace("'", "''")`)，防止 AML / SQL 注入風險。
3. **中文註解要求**：
   - 每個關鍵變數、邏輯區塊與例外處理區塊均需具備詳盡之中文註解說明。
