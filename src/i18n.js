// Shared offline conversion for the renderer and native tray.
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("opencc-js"));
  else root.MigrateI18n = factory(root.OpenCC);
})(typeof globalThis === "object" ? globalThis : this, function (OpenCC) {
  "use strict";
  const toHK = OpenCC.Converter({ from: "cn", to: "hkp" });
  function text(value, locale = "zh-CN") {
    if (locale !== "zh-HK") return String(value);
    return toHK(String(value))
      .replaceAll("設置", "設定")
      .replaceAll("文件", "檔案")
      .replaceAll("視頻", "影片")
      .replaceAll("音頻", "音訊")
      .replaceAll("賬户", "帳戶")
      .replaceAll("用户", "用戶")
      .replaceAll("密鑰", "金鑰")
      .replaceAll("鼠標", "滑鼠")
      .replaceAll("連接", "連線")
      .replaceAll("內存", "記憶體")
      .replaceAll("默認", "預設");
  }
  function bindDocument(document) {
    const records = [],
      attributes = [];
    const walker = document.createTreeWalker(document.documentElement, 4);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (
        node.textContent.trim() &&
        !node.parentElement?.closest(
          "script,style,input,textarea,option,[data-no-localize],.message",
        )
      )
        records.push([node, node.textContent]);
    }
    document
      .querySelectorAll("[title],[aria-label],[placeholder]")
      .forEach((element) => {
        if (element.closest("[data-no-localize]")) return;
        for (const name of ["title", "aria-label", "placeholder"])
          if (element.hasAttribute(name))
            attributes.push([element, name, element.getAttribute(name)]);
      });
    return (locale) => {
      document.documentElement.lang = locale;
      for (const [node, original] of records)
        if (node.isConnected) node.textContent = text(original, locale);
      for (const [element, name, original] of attributes)
        element.setAttribute(name, text(original, locale));
    };
  }
  return { text, bindDocument };
});
