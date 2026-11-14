"use strict";
const api = window.migrate,
  $ = (selector) => document.querySelector(selector);
let settings,
  history = [],
  busy = false,
  activeReply,
  activeRequest,
  noticeTimer,
  clearKey = false,
  videoStarted = false,
  musicUrl = null,
  settingsDirty = false,
  scenePlayer;
for (const selector of [
  "#connection-label",
  "#key-status",
  "#model-label",
  "#toast",
  "#size-value",
  "#music-file",
  "#test-api",
  "#save-settings",
])
  $(selector).setAttribute("data-no-localize", "");
const applyLocale = window.MigrateI18n.bindDocument(document);
const T = (value) =>
  window.MigrateI18n.text(value, settings?.locale || "zh-CN");
function toast(text, error = false, duration = 5500) {
  clearTimeout(noticeTimer);
  $("#toast").textContent = T(text);
  $("#toast").className = `toast${error ? " error" : ""}`;
  noticeTimer = setTimeout(() => $("#toast").classList.add("hidden"), duration);
}
function switchTab(tab) {
  if (tab !== "play") scenePlayer?.pause();
  if (!["chat", "play", "music", "settings"].includes(tab)) tab = "chat";
  document
    .querySelectorAll(".tab-content")
    .forEach((element) =>
      element.classList.toggle("hidden", element.id !== `${tab}-tab`),
    );
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const selected = button.dataset.tab === tab;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  if (tab === "chat") $("#message-input").focus();
}
document
  .querySelectorAll("[data-tab]")
  .forEach((button) => (button.onclick = () => switchTab(button.dataset.tab)));
function openTab(tab) {
  switchTab(tab);
  if (tab === "music" && !videoStarted && !musicUrl) playOriginal();
}
api.onPanel(openTab);
api.getInitialTab().then(openTab);
$("#close").onclick = () => api.closePanel();
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") api.closePanel();
});
function update(value, fillForm = false) {
  settings = value;
  applyLocale(value.locale);
  $("#connection-label").textContent = T(
    value.hasKey ? "DeepSeek 已配置" : "未配置 DeepSeek",
  );
  $("#connection-dot").classList.toggle("connected", value.hasKey);
  $("#key-status").textContent = T(value.hasKey ? "已加密保存" : "未设置");
  $("#model-label").textContent = value.model;
  scenePlayer?.refreshLocale();
  const currentGroup = $("#dialogue-group").value;
  $("#dialogue-group").replaceChildren(
    ...Object.entries(window.MigrateDialogue.groups).map(([id, group]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = T(group.label);
      return option;
    }),
  );
  if (currentGroup) $("#dialogue-group").value = currentGroup;
  $("#save-settings").textContent = T("保存设置");
  if (!$("#test-api").disabled)
    $("#test-api").textContent = T("保存并测试连接");
  if (fillForm || !settingsDirty) {
    $("#api-key").placeholder = T(
      value.hasKey ? "已保存密钥，留空保留" : "sk-…",
    );
    $("#locale").value = value.locale;
    $("#base-url").value = value.baseUrl;
    $("#model").value = value.model;
    $("#shortcut").value = value.shortcut;
    $("#size").value = value.size;
    $("#size-value").textContent = `${Math.round(value.size * 100)}%`;
    $("#always-on-top").checked = value.alwaysOnTop;
    $("#auto-actions").checked = value.autoActions;
    $("#idle-interval").value = value.idleInterval;
    $("#launch-at-login").checked = value.launchAtLogin;
    $("#persona").value = value.persona;
  }
  if (value.keyProblem || value.shortcutError)
    toast(value.keyProblem || value.shortcutError, true, 12000);
}
api.getSettings().then((value) => update(value, true));
api.onSettings((value) => update(value));
$("#settings-form").addEventListener("input", () => {
  settingsDirty = true;
});
$("#size").oninput = () => {
  $("#size-value").textContent = `${Math.round($("#size").value * 100)}%`;
};
$("#delete-key").onclick = () => {
  clearKey = true;
  settingsDirty = true;
  $("#api-key").value = "";
  $("#key-status").textContent = T("保存后移除");
  toast("点击「保存设置」后移除本机密钥。");
};
$("#go-home").onclick = () => api.home();
async function save() {
  if (busy) {
    toast("请先停止当前回复，再修改设置。", true);
    return false;
  }
  const value = {
    baseUrl: $("#base-url").value,
    model: $("#model").value,
    apiKey: $("#api-key").value,
    clearKey,
    locale: $("#locale").value,
    shortcut: $("#shortcut").value,
    size: Number($("#size").value),
    alwaysOnTop: $("#always-on-top").checked,
    autoActions: $("#auto-actions").checked,
    idleInterval: Number($("#idle-interval").value),
    launchAtLogin: $("#launch-at-login").checked,
    persona: $("#persona").value,
  };
  const result = await api.saveSettings(value);
  if (!result.ok) {
    toast(result.error, true);
    return false;
  }
  settingsDirty = false;
  clearKey = false;
  $("#api-key").value = "";
  update(result.settings, true);
  return true;
}
$("#settings-form").onsubmit = async (event) => {
  event.preventDefault();
  $("#save-settings").disabled = true;
  try {
    if (await save()) toast("设置已保存，海风已就位。");
  } catch {
    toast("保存失败，请重试。", true);
  } finally {
    $("#save-settings").disabled = false;
  }
};
$("#test-api").onclick = async () => {
  const button = $("#test-api");
  button.disabled = true;
  button.textContent = T("正在连接…");
  try {
    if (!(await save())) return;
    const result = await api.testConnection();
    toast(
      result.ok ? `连接成功 · ${settings.model}` : result.error,
      !result.ok,
      9000,
    );
  } catch {
    toast("连接测试失败，请重试。", true);
  } finally {
    button.disabled = false;
    button.textContent = T("保存并测试连接");
  }
};
function scrollBottom() {
  const element = $("#messages");
  element.scrollTop = element.scrollHeight;
}
function addMessage(role, text) {
  $("#welcome")?.remove();
  const row = document.createElement("div");
  row.className = `message ${role}`;
  const speaker = document.createElement("span");
  speaker.className = "speaker";
  speaker.textContent = T(role === "user" ? "你 / YOU" : "米格瑞特 / MIGRATE");
  const body = document.createElement("div");
  body.className = "body";
  body.textContent = text;
  row.append(speaker, body);
  $("#messages").append(row);
  scrollBottom();
  return body;
}
function setBusy(value) {
  busy = value;
  $("#send").classList.toggle("hidden", value);
  $("#stop").classList.toggle("hidden", !value);
  $("#clear-chat").disabled = value;
}
async function sendMessage() {
  if (busy) return;
  const text = $("#message-input").value.trim();
  if (!text) return;
  if (!settings?.hasKey) {
    switchTab("settings");
    toast("先填写你的 DeepSeek API Key，再开始对话。");
    $("#api-key").focus();
    return;
  }
  const previous = history;
  const request = [...history, { role: "user", content: text }];
  addMessage("user", text);
  $("#message-input").value = "";
  activeReply = addMessage("assistant", "");
  activeReply.classList.add("pending");
  activeRequest = { previous, request };
  setBusy(true);
  try {
    const result = await api.startChat(request);
    if (!result.ok) {
      activeReply.classList.remove("pending");
      activeReply.classList.add("failed");
      activeReply.textContent = T(result.error);
      setBusy(false);
      activeRequest = null;
    }
  } catch {
    activeReply.textContent = T("请求失败，请重试。");
    activeReply.classList.remove("pending");
    setBusy(false);
    activeRequest = null;
  }
}
$("#chat-form").onsubmit = (event) => {
  event.preventDefault();
  sendMessage();
};
$("#message-input").onkeydown = (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
};
$("#stop").onclick = () => api.stopChat();
document.querySelectorAll(".suggestions button").forEach(
  (button) =>
    (button.onclick = () => {
      $("#message-input").value = button.textContent;
      sendMessage();
    }),
);
api.onChat((event) => {
  if (!busy || !activeReply || !activeRequest) return;
  if (event.type === "delta") {
    activeReply.classList.remove("pending");
    activeReply.textContent += event.text;
    scrollBottom();
    return;
  }
  activeReply.classList.remove("pending");
  const answer = activeReply.textContent;
  if (event.type === "done" || (event.type === "stopped" && answer.trim())) {
    history = [
      ...activeRequest.request,
      { role: "assistant", content: answer },
    ].slice(-24);
    if (event.truncated) toast("回复达到长度上限，可以请她继续。");
    if (event.type === "stopped") toast("已停止回复。");
  } else {
    history = activeRequest.previous;
    if (answer.trim())
      activeReply.textContent += `\n\n${T(event.text || "已停止回复。")}`;
    else {
      activeReply.textContent = T(event.text || "已停止回复。");
      activeReply.classList.add("failed");
    }
  }
  activeRequest = null;
  setBusy(false);
  scrollBottom();
});
$("#clear-chat").onclick = () => {
  if (busy) return;
  history = [];
  $("#messages").replaceChildren();
  addMessage("assistant", T("新的航程开始了。今天，想聊些什么？"));
  toast("对话已清空。");
};
function playOriginal() {
  $("#local-audio").pause();
  $("#video-wrap").classList.remove("hidden");
  $("#music-video").src =
    "https://player.bilibili.com/player.html?bvid=BV1wT4y1k7Pw&autoplay=1";
  videoStarted = true;
}
function stopOriginal() {
  $("#music-video").removeAttribute("src");
  $("#video-wrap").classList.add("hidden");
  videoStarted = false;
}
$("#play-original").onclick = playOriginal;
$("#stop-original").onclick = stopOriginal;
$("#open-original").onclick = () => api.openMusicPage();
$("#choose-music").onclick = async () => {
  try {
    const result = await api.chooseMusic();
    if (!result || result.cancelled) return;
    if (!result.ok) {
      toast(result.error, true);
      return;
    }
    stopOriginal();
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    musicUrl = URL.createObjectURL(
      new Blob([result.bytes], { type: result.type }),
    );
    $("#local-audio").src = musicUrl;
    $("#music-file").textContent = result.name;
    await $("#local-audio").play();
    api.action("happy");
  } catch {
    toast("无法播放此音频，请选择 MP3、WAV、OGG、FLAC 或 M4A 文件。", true);
  }
};
$("#local-audio").addEventListener("error", () =>
  toast("音频格式不受支持或文件损坏，请重新选择。", true),
);
$("#local-audio").addEventListener("play", stopOriginal);
document.querySelectorAll("[data-action]").forEach((button) => {
  button.onclick = () => api.action(button.dataset.action);
});
$("#speak-line").onclick = () => api.speak($("#dialogue-group").value);
scenePlayer = new window.MigrateSceneTheater.ScenePlayer($("#scene-player"), T);
document.querySelectorAll("[data-scene]").forEach((button) => {
  button.onclick = () => {
    clearTimeout(noticeTimer);
    $("#toast").classList.add("hidden");
    scenePlayer.play(button.dataset.scene);
  };
});
$("#open-problem").onclick = () => api.openProblem();
