# Aras Innovator R36 - Client Form Multi-Label Field (`bcs_label`) 元件

本專案為 **Aras Innovator R36** 開發的自訂前端表單標籤選擇器（Multi-Label / Tag Chips Field）。
支援自訂色彩、**Aras 原生多語系（Multilingual / I18N）**、排序、即時搜尋過濾，並以自訂 ItemType **`bcs_label`** 與關聯表 **`bcs_label_tags`** 作為標籤來源目錄，資料以 **JSON 陣列字串**儲存於目標文字欄位。

---

## 目錄
1. [功能特點](#功能特點)
2. [資料模型與儲存格式](#資料模型與儲存格式)
3. [多語系 (I18N) 運作機制](#多語系-i18n-運作機制)
4. [Aras Innovator R36 安裝與設定指引](#aras-innovator-r36-安裝與設定指引)
   - [步驟 1：匯入或建立 `bcs_label` 與 `bcs_label_tags`](#步驟-1匯入或建立-bcs_label-與-bcs_label_tags)
   - [步驟 2：在目標 ItemType 建立文字欄位](#步驟-2在目標-itemtype-建立文字欄位)
   - [步驟 3：在 Form 放置 HTML Field](#步驟-3在-form-放置-html-field)
   - [步驟 4：設定 Form Event (`onFormPopulated`)](#步驟-4設定-form-event-onformpopulated)
5. [本機開發與測試](#本機開發與測試)
   - [單元測試 (Unit Tests)](#單元測試-unit-tests)
   - [瀏覽器模擬展示 (E2E Demo)](#瀏覽器模擬展示-e2e-demo)
6. [GitHub 版本控管與上傳指引](#github-版本控管與上傳指引)

---

## 功能特點
- 🌐 **全方位多語系感知 (Multilingual / I18N)**：深度整合 Aras Web Client Session 語系，依使用者登入語系（如 `zh-TW`, `zh-CN`, `en`, `ja`）動態呈現對應標籤文字與搜尋索引。
- 🎨 **色彩感知標籤徽章 (Color Badges)**：標籤依據 `color` 欄位渲染，自動計算最佳黑/白文字對比色，視覺層次清晰。
- 🔍 **智慧過濾下拉選單**：輸入文字即時過濾可用標籤（支援按 Name 或當下語系 Label 搜尋），並支援鍵盤上下鍵與 Enter 選取。
- 📦 **結構化多語系 JSON 儲存 (Option B)**：以標準 JSON 陣列儲存標籤元數據 (`name`, `label`, `labels: { [lang]: string }`, `color`, `sort_id`)，完整保留多語系與樣式資訊。
- 🔒 **表單狀態聯動**：完美支援 Aras R36 生命週期，View Mode 自動切換為純徽章唯讀，Edit Mode 允許選取與刪除。
- ⚡ **零相依原生架構**：採用 Vanilla JavaScript (ES6+) 與現代 CSS，嚴格遵循 S.O.L.I.D 原則。

---

## 多語系 (I18N) 運作機制
1. **來源定義 (`bcs_label_tags.label`)**：
   - 欄位型態設定為 `ml_string`（多語系字串）。管理員可以在後台分別維護各語言的顯示名稱（例如繁中「緊急處理」、簡中「紧急处理」、英文「Urgent Action」）。
2. **Client 端自動偵測**：
   - 前端適配器透過 `aras.getSessionContext().getLanguageCode()` 取得使用者當前語系代碼（例如 `zh-TW`）。
3. **優雅退回（Fallback）原則**：
   - 當前語系精確比對（如 `zh-TW`） -> 基礎語言代碼比對（如 `zh`） -> 實體預設名稱（`label`） -> 英文（`en`） -> 標籤唯一代碼（`name`）。

---

## 資料模型與儲存格式

### 標籤來源模型 (`bcs_label`)
- **主表 ItemType**: `bcs_label`
  - `name` (String, 長度: 64) - 標籤分類目錄名稱（如 `Part_Labels`）
- **關聯表 Relationship**: `bcs_label_tags`
  - `sort_id` (Float) - 排序序號
  - `name` (String, 長度: 32) - 標籤鍵值代碼（例如 `urgent`）
  - `label` (Multilingual String `ml_string`, 長度: 64) - 各語系顯示文字
  - `color` (Color / String, 長度: 32) - 色彩十六進制代碼（例如 `#EF4444`）

### 目標文字欄位儲存格式 (多語系 JSON)
```json
[
  {
    "name": "urgent",
    "label": "緊急處理",
    "labels": {
      "zh-TW": "緊急處理",
      "zh-CN": "紧急处理",
      "en": "Urgent Action"
    },
    "color": "#EF4444",
    "sort_id": 1.0
  },
  {
    "name": "design",
    "label": "設計中",
    "labels": {
      "zh-TW": "設計中",
      "zh-CN": "设计中",
      "en": "In Design"
    },
    "color": "#3B82F6",
    "sort_id": 2.0
  }
]
```

---

## Aras Innovator R36 安裝與設定指引

### 步驟 1：匯入或建立 `bcs_label` 與 `bcs_label_tags`
提供兩種方式建立此模型：

#### 方式 A：透過 AML 快速匯入（推薦）
將專案中 `src/aras/aml/bcs_label_ItemType.xml` 複製，在 Aras Web Client 的 **Administration > Apply AML** 執行，即可一鍵建立 `bcs_label` ItemType 與 `bcs_label_tags` 關聯。

#### 方式 B：手動介面建立
1. **建立主表 ItemType**:
   - 進入 **Administration > ItemTypes** > 建立新項目。
   - Name: `bcs_label`，Label: `標籤目錄`。
   - 在 Properties 中確認/新增 `name` (String, 64)。
2. **建立關聯 Relationship**:
   - 切換至 **RelationshipTypes** 頁籤，新增關聯 `bcs_label_tags`。
   - 關聯表屬性新增：
     - `sort_id` (Float)
     - `name` (String, 32)
     - `label` (Data Type 選 `ml_string`, 長度 64)
     - `color` (Color, 32)
3. **建立標籤資料**:
   - 進入 **TOC > 標籤目錄 (bcs_label)**，新增一筆如 `Part_Labels`。
   - 在其 `bcs_label_tags` 關聯頁籤新增多筆彩色標籤，並於多語系介面分別鍵入繁中、英文等文字後儲存解鎖。

### 步驟 2：在目標 ItemType 建立文字欄位
在需要使用標籤的 ItemType（例如 `Part` 或自訂 ItemType）：
1. 進入 ItemType Properties 頁籤。
2. 新增屬性：
   - **Name**: `labels`
   - **Label**: `標籤`
   - **Data Type**: `String`（長度建議設為 `2048` 或以上）或 `Text`。
3. 儲存 ItemType。

### 步驟 3：在 Form 放置 HTML Field
1. 進入該 ItemType 的 Form 編輯畫面。
2. 在表單工具列拖入一個 **HTML Field**：
   - **Field Name**: `field_bcs_labels`
   - **Field Label**: `標籤 (Labels)`
   - **Field Type**: `html`
3. 點擊該欄位之 **HTML Code**，貼入 `src/aras/Form_MultiLabel_Field.html` 中的程式碼。

### 步驟 4：設定 Form Event (`onFormPopulated`)
1. 在 Form 的 **Form Events** 頁籤新增事件關聯：
   - **Event**: `onFormPopulated`
   - **Method Name**: `bcs_init_multi_label_field`
2. Method 內容參照 `src/aras/Method_initMultiLabel.js`：
   ```javascript
   // 初始化多標籤欄位
   if (window.initBcsMultiLabelField) {
     window.initBcsMultiLabelField({
       containerId: "bcs_label_container",
       propertyName: "labels",              // 目標儲存屬性
       labelCategoryName: "Part_Labels"    // bcs_label 的目錄名稱
     });
   }
   ```
3. 儲存並解鎖 Form。

---

## 本機開發與測試

### 單元測試 (Unit Tests)
本專案提供核心資料模型與狀態管理、多語系解析之單元測試：
```bash
node --test tests/unit/LabelTag.test.js tests/unit/LabelStore.test.js
```

### 瀏覽器模擬展示 (E2E Demo)
在 `tests/demo/index.html` 內嵌了模擬 Aras Client 環境：
1. 具備模擬的 `bcs_label` / `bcs_label_tags` 資料來源（含中英文等多語系）。
2. 支援即時切換 Session 語系（`zh-TW` / `en` / `zh-CN`），觀察標籤與下拉選單動態更新。
3. 支援切換 View Mode (唯讀) 與 Edit Mode (可編輯)。
4. 即時顯示目標文字欄位的多語系 JSON 儲存內容。

---

## GitHub 版本控管與上傳指引

本專案第一版開發完成後，透過 GitHub CLI (`gh`) 建立遠端儲存庫並推送：
```bash
git init
git add .
git commit -m "feat: initial commit of Aras Innovator R36 multi-label field component with multilingual support"
gh repo create aras-label --public --source=. --remote=origin --push
```
