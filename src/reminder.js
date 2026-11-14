"use strict";
const api = window.migrate;
const applyLocale = window.MigrateI18n.bindDocument(document);
function update(value) {
  if (!value) return;
  applyLocale(value.locale);
  document.querySelector("#names").textContent = value.items
    .map(
      (item) =>
        `${item.provider === "codeforces" ? "Codeforces" : "AtCoder"} · ${item.name}`,
    )
    .join("\n");
}
api.getReminder().then(update);
api.onReminder(update);
document.querySelector("#close").onclick = () => api.closeReminder();
document.querySelector("#view").onclick = () => api.viewReminder();
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") api.closeReminder();
});
