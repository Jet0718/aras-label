/**
 * @file Method_initMultiLabel.js
 * @description Aras Innovator Form Event (onFormPopulated) Client Method
 * 負責在表單開啟時，初始化並掛載 Multi-Label 前端組件。
 */

// 方法主體 (在 Aras Form Events 中設定為 onFormPopulated)
try {
  // 取得目標欄位容器與配置
  var containerId = "bcs_label_container";
  var targetPropertyName = "labels";              // 目標儲存 JSON 的屬性名稱
  var categoryName = "Part_Labels";               // 對應的 bcs_label 目錄名稱

  if (window.initBcsMultiLabelField) {
    window.initBcsMultiLabelField({
      containerId: containerId,
      propertyName: targetPropertyName,
      labelCategoryName: categoryName
    });
  } else {
    console.warn("bcs_init_multi_label: 尚未載入 initBcsMultiLabelField 組件函式。");
  }
} catch (e) {
  aras.AlertError("多標籤元件載入異常：" + e.message);
}
