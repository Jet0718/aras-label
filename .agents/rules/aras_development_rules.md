# Aras Innovator 程式設計避坑知識與語法防護守則 (aras_development_rules.md)

本文件沉澱自實戰開發歷次遭遇之語法錯誤、Linter 警告與架構踩坑經驗，旨在確保所有後續 Aras Innovator 相關專案（Client/Server/AML）開發時嚴格遵循，徹底避免重複發生相同錯誤。

---

## 一、 Client Method (前端 JavaScript / Monaco Editor / TypeScript 檢查器)

### 1. 消除 `implicitly has an 'any' type` 警告
- **問題現象**：
  Aras Method 編輯器 Check Syntax 報錯：
  `Parameter 'xxx' implicitly has an 'any' type, but a better type may be inferred from usage.`
- **根本原因**：
  Aras R36 內建之 Monaco Editor 啟用了 TypeScript 檢查器且配置了 `noImplicitAny: true`。純 JavaScript 函式之參數若未帶預設值且無型別推斷，即會被判定為 warning。
- **標準解法**：
  **所有函式參數、事件回調參數、陣列 map/some/filter 參數，一律顯式賦予安全預設值**：
  ```javascript
  // 正確寫法：全數賦予預設值
  function injectStyles(targetDoc = null) { ... }
  function getContrastColor(hexColor = "") { ... }
  function formatCellElement(cellEl = null, targetDoc = null) { ... }
  btn.onclick = function (evt = null) { ... };
  parts.map((p = "") => p.trim());
  ```

### 2. 消除 `JSDoc types may be moved to TypeScript types` (TS80001) 提示
- **問題現象**：
  Aras Check Syntax 報提示：
  `JSDoc types may be moved to TypeScript types. on line XX`
- **根本原因**：
  TypeScript Language Server 在偵測到帶有 `{Type}` 花括號的 JSDoc（如 `/** @param {Document|null} doc */`）時，會發出 TS80001 重構建議。但 Aras Client Method 在瀏覽器執行時為純 JavaScript，若轉寫為 TypeScript（`: Type`）語法，在執行期會拋出 `SyntaxError: Unexpected token ':'`。
- **標準解法**：
  **切勿在純 JS 中撰寫 TypeScript 語法，亦不要在 JSDoc 中使用 `{Type}` 花括號**。
  改用乾淨清晰的中文註解說明參數與回傳值，搭配上述之「參數預設值」，即可同時滿足無 any 警告、無 JSDoc 轉型提示：
  ```javascript
  // --------------------------------------------------------------------------
  // 4. 計算高對比文字顏色 (深底配白字，淺底配深字)
  // 參數: hexColor (預設 "") - 十六進制色彩碼
  // 回傳: 高對比文字色 ("#1E293B" 或 "#FFFFFF")
  // --------------------------------------------------------------------------
  function getContrastColor(hexColor = "") { ... }
  ```

### 3. 消除 `'xxx' is declared but its value is never read` (TS6133) 警告
- **問題現象**：
  Aras Check Syntax 報錯：
  `'headId' is declared but its value is never read.`
  `'searchTriggered' is declared but its value is never read.`
- **根本原因**：
  Aras Monaco 檢查器啟用了 `noUnusedLocals: true`，當解構出未使用的鍵值（如 `for (const [k, v] of map.entries())` 只用到 `v`）或宣告了僅有賦值但後續無讀取邏輯的變數時，會被標記為語法檢查錯誤。
- **標準解法**：
  1. Map / Object 迭代時若僅需 value，一律使用 `for (const val of map.values())`，避免解構出無用之 key 變數。
  2. 迴圈或狀態判斷直接使用 `break` 或即時回傳，嚴禁聲明後續未被讀取引用的冗餘旗標變數。

### 4. HyperGrid (Inferno.js) Virtual DOM 零破壞與防錯位守則 (Anti-InsertBefore-Error)
- **問題現象**：
  拖拉欄寬或更換欄位順序時，Console 噴發：
  `NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.`
  且單元格錯位（例如 `State` 欄位被彩色標籤徽章覆蓋）。
- **根本原因**：
  Aras R36 主網格採用 HyperGrid (基於 Inferno.js Virtual DOM)，具備 DOM 節點重用機制。若使用 `cellEl.innerHTML = ""` 或刪除節點，會摧毀 Virtual DOM 內部追蹤的原生子節點。當欄位重用時，Inferno 的 `insertBefore(newNode, oldNode)` 找不到 `oldNode` 即崩潰，導致單元格未被重繪，殘留上次的徽章並污染非標籤欄位。
- **標準解法**：
  1. **零破壞渲染 (Zero-Destruction)**：嚴禁清空單元格子節點！原生 TextNode 保留在 DOM 樹內供 diffing 比對，原生文字改以 CSS `font-size: 0 !important; color: transparent !important;` 隱藏。
  2. **獨立疊加徽章層**：彩色徽章容器 `.bcs-grid-tags-cell` 採絕對定位覆蓋於單元格之上。
  3. **欄位特徵檢驗**：非標籤欄位（如 State）若帶有殘留徽章，立即安全清除並還原文字。

### 5. 純淨 TextNode 防污染守則 (Anti-Contamination-Text-Extraction)
- **問題現象**：
  反覆更換搜尋條件時，後端搜尋正確（例如搜出含有 VIP重點 的唯一零件），但畫面上該列的標籤依然顯示為上一次搜尋留下的「緊急處理」「設計審查」。
- **根本原因**：
  使用 `cellEl.textContent` 讀取資料時，瀏覽器會將原生 TextNode 與先前追加的徽章容器內部的文字全部拼接在一起（如 `[{"name":"vip"...}]緊急處理設計審查`）。導致切換資料行時 `JSON.parse` 拋出語法例外中斷，徽章永遠無法更新。
- **標準解法**：
  遍歷 `cellEl.childNodes`，僅提取純粹的 TextNode (nodeType === 3)，徹底排除 `.bcs-grid-tags-cell` 的干擾，確保反覆搜尋時 JSON 解析 100% 準確無誤。

### 6. Grid 搜尋列 (Search Row) DOM 防破壞與防裁切原則
- **問題現象**：
  直接包裝搜尋列 input 或在格子內掛載彈跳選單時，彈窗被截斷看不見，或者 Grid 重繪時 input 遺失跑版。
- **根本原因**：
  Aras HyperGrid 的搜尋列由網格核心控制，具備虛擬滾動 (Virtual Scroll) 與動態重繪機制，且單元格通常設有 `overflow: hidden`。
- **標準解法**：
  1. **非侵入式結構**：絕不替換或以額外 `wrapper` 節點包裹原生 `<input>`，標籤小按鈕採同層絕對重疊定位，點擊 input 本身或按鈕均可觸發。
  2. **防裁切定位**：所有浮層選單 (Popover / Modal) 直接掛載於頂層 `document.body`，採用 `position: fixed` 與極高之 `z-index: 999999`，動態依 `input.getBoundingClientRect()` 精確計算彈出座標。

### 4. 表頭欄位三重容錯探測機制
- **問題現象**：
  找不到「標記」或「labels」欄位之 input，導致擴充功能未掛載。
- **根本原因**：
  表頭單元格類別可能是 `.aras-grid-head-cell`、`.aras-grid-header-cell` 或 `th`，且表頭文字受多語系或排序圖示干擾。
- **標準解法**：
  採用三重容錯比對：
  1. 第一重：比對表頭文字包含「標記」、「標籤」或「labels」。
  2. 第二重：比對單元格屬性（`data-key`, `data-index`, `data-head-id`）。
  3. 第三重：掃描資料列已渲染的特徵（如 JSON 格式 `[{"name":` 或已彩化元素），反向鎖定欄位 index。

---

## 二、 Server Method (後端 C# .NET / Method Wrapper 機制)

### 1. 嚴禁頂層 `using` 與 `namespace`
- **問題現象**：
  C# Method 編譯報錯：`CS1529: A using clause must precede all other elements` 或語法解析失敗。
- **根本原因**：
  Aras Innovator 編譯 C# Method 時，會將程式碼本體自動封裝於 `ItemMethod.methodCode()` 內部。因此頂層 `using` 會被編譯器視為方法體內部的 `using statement` 宣告。
- **標準解法**：
  - 不寫頂層 `using` 與 `namespace`，直接撰寫方法體邏輯。
  - Aras 平台已自動引用 `System`, `System.Collections.Generic`, `Aras.IOM`。
  - 特殊型別直接使用完整命名空間（如 `System.Xml.XmlDocument`, `System.Text.RegularExpressions.Regex`）。

### 2. 確保所有分支路徑皆返回 `Item`
- **問題現象**：
  編譯報錯：`not all code paths return a value`。
- **標準解法**：
  正常結束請明確返回 `this;`；例外處理區塊（catch）請返回 `inn.newError(...)`，嚴禁遺漏 return。

### 3. AML / SQL 注入防範
- **問題現象**：
  使用者輸入含單引號（`'`）字元時，AML 查詢崩潰或出現注入漏洞。
- **標準解法**：
  所有外部輸入用於拼接查詢條件前，必須進行單引號字元轉義：
  ```csharp
  string safeTerm = term.Replace("'", "''");
  ```

### 4. 嚴禁在 IOM 查詢中對多語系 (ml_string) 欄位使用原生 SQL WHERE 屬性
- **問題現象**：
  使用 `tagQuery.setAttribute("where", $"[bcs_label_tags].label LIKE N'%{term}%'")` 查詢標籤目錄時，SQL Server 報錯 `Invalid column name 'label'`，或被 Aras 忽略導致取回錯誤標籤（例如搜「VIP重點」卻永遠被改寫為第一筆「緊急處理」）。
- **根本原因**：
  `ml_string` 欄位在 SQL Server 主表中不存在實體 column，而是存於多語系副表。直接寫 SQL `where` 會導致語法崩潰。
- **標準解法**：
  標籤目錄數量有限（通常幾十筆內），**一律一次性取得全數項目 (`select="name,label"`)，在 C# 記憶體中做大小寫無關 (`OrdinalIgnoreCase`) 之精準比對**，絕不依賴脆弱的 SQL `where` 屬性。


---

## 三、 AML 模型結構與資料匯入 (Schema & Data)

### 1. 嚴禁在 AML 中指定非標準或自訂格式 ID
- **問題現象**：
  Apply AML 失敗，報錯 `ID must be a 32 character hex string`。
- **標準解法**：
  在建立 ItemType、Property、RelationshipType 時，不要傳入自訂字串 ID，讓 Aras 核心自動分配合法之 32 碼 Hex GUID。

### 2. 關聯表 RelationshipType 建立規範
- **問題現象**：
  Relationship Item 缺少 `source_id` 或關聯外鍵約束。
- **標準解法**：
  建立 `RelationshipType` 時，底層關聯 ItemType 必須直接嵌套於 `<relationship_id>` 內一併建立，不可在外層獨立建立為一般 ItemType。

### 3. 權限設定 (Permission & Can Add)
- **問題現象**：
  ItemType 建立成功，但新增資料實例時回傳 Permission Denied。
- **標準解法**：
  建立 ItemType 時，必須一併配置 `Allowed Permission`（指定 `is_default=1`，如 `Default Access`）與 `ItemType Can Add`（授權如 `World` 身分）。
