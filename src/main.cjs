"use strict";
const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  screen,
  safeStorage,
  dialog,
  session,
  shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  DEFAULTS,
  validateSettings,
  clampBounds,
  requestChat,
  upgradeDefaultPersona,
} = require("./core.cjs");
const { text: localize } = require("./i18n.js");
const dialogue = require("./dialogue.js");

app.setName("csp-migrate");
if (process.env.MIGRATE_USER_DATA)
  app.setPath("userData", path.resolve(process.env.MIGRATE_USER_DATA));
app.setAppUserModelId("com.csp.migrate");
let pet,
  panel,
  tray,
  settings,
  apiKey = "",
  keyProblem = "",
  shortcutError = "",
  panelTab = "chat";
let quitting = false,
  currentRequest = null,
  drag = null,
  dragTimer = null,
  moveTimer = null,
  saveTimer = null;
const allowedActions = new Set([
  "idle",
  "wave",
  "turn",
  "magic",
  "happy",
  "sleep",
  "walk-left",
  "walk-right",
  "talk",
  "nod",
  "shake",
  "bounce",
  "float",
  "birds",
  "stretch",
  "shy",
  "sway",
  "looksea",
  "peek",
]);
const petFile = path.join(__dirname, "pet.html"),
  panelFile = path.join(__dirname, "panel.html");
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");
const send = (win, channel, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};
const encryptionReady = async () =>
  typeof safeStorage.isAsyncEncryptionAvailable === "function"
    ? safeStorage.isAsyncEncryptionAvailable()
    : safeStorage.isEncryptionAvailable();
const encrypt = async (value) =>
  typeof safeStorage.encryptStringAsync === "function"
    ? safeStorage.encryptStringAsync(value)
    : safeStorage.encryptString(value);
const decrypt = async (value) =>
  typeof safeStorage.decryptStringAsync === "function"
    ? safeStorage.decryptStringAsync(value)
    : safeStorage.decryptString(value);

function persist(value) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  const temporary = settingsPath() + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, settingsPath());
}
async function loadSettings() {
  settings = { ...DEFAULTS };
  try {
    const value = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    settings = validateSettings(value);
    settings.persona = upgradeDefaultPersona(settings.persona);
    if (
      value.position &&
      Number.isFinite(value.position.x) &&
      Number.isFinite(value.position.y)
    )
      settings.position = { x: value.position.x, y: value.position.y };
    settings.encryptedKey =
      typeof value.encryptedKey === "string" ? value.encryptedKey : "";
    if (settings.encryptedKey) {
      try {
        apiKey = await decrypt(Buffer.from(settings.encryptedKey, "base64"));
      } catch {
        keyProblem = "保存的密钥无法在此 Windows 账户下解密，请重新填写。";
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT")
      keyProblem = "本地设置无法读取，已使用默认设置。";
  }
}
function publicSettings() {
  const { encryptedKey, ...value } = settings;
  return {
    ...value,
    hasKey: Boolean(apiKey),
    keyProblem,
    shortcutError,
    version: app.getVersion(),
  };
}
function broadcastSettings() {
  send(pet, "settings:updated", publicSettings());
  send(panel, "settings:updated", publicSettings());
  updateTray();
  if (panel && !panel.isDestroyed())
    panel.setTitle(localize("Migrate · 对话与设置", settings.locale));
}
function guardedWindow(options, file) {
  const win = new BrowserWindow({
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "../assets/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
    ...options,
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.loadFile(file);
  return win;
}
function petBounds(home = false) {
  const width = Math.round(320 * settings.size),
    height = Math.round(420 * settings.size);
  const pos = home ? null : settings.position;
  const display = pos
    ? screen.getDisplayNearestPoint(pos)
    : screen.getPrimaryDisplay();
  const area = display.workArea;
  return clampBounds(
    {
      width,
      height,
      x: pos?.x ?? area.x + area.width - width - 12,
      y: pos?.y ?? area.y + area.height - height - 8,
    },
    area,
  );
}
function repositionPanel() {
  if (!panel || panel.isDestroyed() || !pet || pet.isDestroyed()) return;
  const b = pet.getBounds(),
    area = screen.getDisplayMatching(b).workArea;
  const width = Math.min(432, area.width),
    height = Math.min(650, area.height - 16);
  let x = b.x - width + 40;
  if (x < area.x) x = b.x + b.width - 40;
  panel.setBounds(
    clampBounds({ x, y: b.y + b.height - height, width, height }, area),
  );
}
function rememberPosition() {
  if (!pet || pet.isDestroyed()) return;
  const { x, y } = pet.getBounds();
  settings.position = { x, y };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      persist(settings);
    } catch {
      /* Keep the running pet usable when the disk is unavailable. */
    }
  }, 300);
}
function createPet() {
  pet = guardedWindow(
    {
      ...petBounds(),
      title: "Migrate · 米格瑞特",
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      skipTaskbar: true,
      alwaysOnTop: settings.alwaysOnTop,
      thickFrame: false,
    },
    petFile,
  );
  pet.setIgnoreMouseEvents(true, { forward: true });
  pet.once("ready-to-show", () => {
    pet.showInactive();
    broadcastSettings();
  });
  pet.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      hidePet();
    }
  });
  pet.on("move", () => {
    repositionPanel();
    rememberPosition();
  });
}
function showPet() {
  if (!pet || pet.isDestroyed()) createPet();
  const wasVisible = pet.isVisible();
  const b = pet.getBounds(),
    area = screen.getDisplayMatching(b).workArea;
  pet.setBounds(clampBounds(b, area));
  pet.showInactive();
  updateTray();
  if (!wasVisible && !pet.webContents.isLoading())
    send(pet, "pet:animate", { group: "welcomeBack" });
}
function hidePet() {
  stopDrag();
  stopWalk();
  pet?.hide();
  panel?.hide();
  updateTray();
}
function togglePet() {
  pet?.isVisible() ? hidePet() : showPet();
}
function openPanel(tab = "chat") {
  panelTab = tab;
  showPet();
  stopWalk();
  if (!panel || panel.isDestroyed()) {
    panel = guardedWindow(
      {
        width: 432,
        height: 650,
        title: "Migrate · 对话与设置",
        backgroundColor: "#f6f8fc",
        alwaysOnTop: settings.alwaysOnTop,
        minWidth: 360,
        minHeight: 430,
      },
      panelFile,
    );
    panel.on("close", (event) => {
      if (!quitting) {
        event.preventDefault();
        panel.hide();
      }
    });
    panel.once("ready-to-show", () => {
      repositionPanel();
      panel.show();
      send(panel, "panel:tab", tab);
    });
  } else {
    repositionPanel();
    panel.show();
    send(panel, "panel:tab", tab);
  }
}
function homePet() {
  stopWalk();
  stopDrag();
  settings.position = null;
  pet.setBounds(petBounds(true));
  rememberPosition();
  showPet();
  animate("wave");
}
function animate(action) {
  send(pet, "pet:animate", action);
}
function stopWalk() {
  clearInterval(moveTimer);
  moveTimer = null;
}
function action(value) {
  if (!allowedActions.has(value)) return;
  stopWalk();
  animate(value);
  if (!value.startsWith("walk-")) return;
  const direction = value === "walk-left" ? -1 : 1;
  let steps = 0;
  moveTimer = setInterval(() => {
    if (!pet?.isVisible() || drag || ++steps > 95) {
      stopWalk();
      animate("idle");
      return;
    }
    const b = pet.getBounds(),
      area = screen.getDisplayMatching(b).workArea;
    const next = clampBounds({ ...b, x: b.x + direction * 2 }, area);
    if (next.x === b.x) {
      stopWalk();
      animate("wave");
      return;
    }
    pet.setBounds(next);
  }, 30);
}
function startDrag() {
  if (drag) return;
  stopWalk();
  const cursor = screen.getCursorScreenPoint(),
    b = pet.getBounds();
  drag = { cursor, bounds: b, moved: false };
  pet.setIgnoreMouseEvents(false);
  dragTimer = setInterval(() => {
    if (!drag || !pet?.isVisible()) return stopDrag();
    const point = screen.getCursorScreenPoint(),
      dx = point.x - drag.cursor.x,
      dy = point.y - drag.cursor.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) {
      if (!drag.moved) {
        drag.moved = true;
        animate(dx < 0 ? "drag-left" : "drag-right");
      }
      const area = screen.getDisplayNearestPoint(point).workArea;
      pet.setBounds(
        clampBounds(
          { ...drag.bounds, x: drag.bounds.x + dx, y: drag.bounds.y + dy },
          area,
        ),
      );
    }
  }, 16);
  // Safety net if pointer capture is lost by the OS.
  drag.timeout = setTimeout(stopDrag, 15000);
}
function stopDrag() {
  if (!drag) return;
  clearTimeout(drag.timeout);
  clearInterval(dragTimer);
  const moved = drag.moved;
  drag = null;
  rememberPosition();
  if (moved) animate("drop");
}
function menuTemplate() {
  const items = [
    {
      label: pet?.isVisible() ? "隐藏米格瑞特" : "显示米格瑞特",
      accelerator: settings.shortcut,
      click: togglePet,
    },
    { label: "和她聊聊", click: () => openPanel("chat") },
    { label: "设置 / DeepSeek API", click: () => openPanel("settings") },
    { label: "听《白鸟过河滩》", click: () => openPanel("music") },
    { label: "互动动作与台词", click: () => openPanel("play") },
    { label: "打开 QOJ · CSP-S 2026《迁徙》", click: openProblem },
    { type: "separator" },
    {
      label: "动作",
      submenu: [
        { label: "挥手", click: () => action("wave") },
        { label: "转身", click: () => action("turn") },
        { label: "向左散步", click: () => action("walk-left") },
        { label: "向右散步", click: () => action("walk-right") },
        { label: "潮汐魔法", click: () => action("magic") },
        { label: "召唤海鸟", click: () => action("birds") },
        { label: "海风漂浮", click: () => action("float") },
        { label: "开心", click: () => action("happy") },
        { label: "打个盹", click: () => action("sleep") },
        { label: "认真点头", click: () => action("nod") },
        { label: "轻轻摇头", click: () => action("shake") },
        { label: "轻跃一下", click: () => action("bounce") },
        { label: "伸展身体", click: () => action("stretch") },
        { label: "有点害羞", click: () => action("shy") },
        { label: "随风摇摆", click: () => action("sway") },
        { label: "回身看海", click: () => action("looksea") },
        { label: "探头看看", click: () => action("peek") },
      ],
    },
    { label: "回到右下角", click: homePet },
    { type: "separator" },
    {
      label: "退出 Migrate",
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ];
  function translate(items) {
    return items.map((item) => ({
      ...item,
      ...(item.label ? { label: localize(item.label, settings.locale) } : {}),
      ...(item.submenu ? { submenu: translate(item.submenu) } : {}),
    }));
  }
  return translate(items);
}
function openProblem() {
  send(pet, "pet:animate", { group: "problem" });
  const language = settings.locale === "zh-HK" ? "yue_hk" : "zh_cn";
  shell
    .openExternal(`https://qoj.ac/problem/24562/statement/${language}`)
    .catch(() => {});
}
function updateTray() {
  if (tray && !tray.isDestroyed())
    tray.setContextMenu(Menu.buildFromTemplate(menuTemplate()));
}
function createTray() {
  tray = new Tray(
    nativeImage.createFromPath(path.join(__dirname, "../assets/tray.png")),
  );
  tray.setToolTip("米格瑞特 · Migrate");
  tray.on("double-click", togglePet);
  updateTray();
}
function trusted(event, kind) {
  const expected = kind === "pet" ? pet : panel;
  const expectedFile = kind === "pet" ? petFile : panelFile;
  return Boolean(
    expected &&
    event.sender === expected.webContents &&
    event.senderFrame?.url === pathToFileURL(expectedFile).href,
  );
}
function anyTrusted(event) {
  return trusted(event, "pet") || trusted(event, "panel");
}
function readableError(error) {
  if (error.name === "AbortError") return "已停止回复。";
  if (error.name === "TimeoutError") return "连接超时，请检查网络或稍后重试。";
  if (error instanceof TypeError)
    return "无法连接 API，请检查网络和 API 地址。";
  return error.message || "请求失败，请稍后重试。";
}
async function saveSettings(raw) {
  if (currentRequest)
    throw new Error("请先停止当前回复或连接测试，再修改设置。");
  const next = validateSettings(raw, settings);
  let nextKey = apiKey;
  if (raw.clearKey === true) {
    nextKey = "";
    next.encryptedKey = "";
  }
  if (typeof raw.apiKey === "string" && raw.apiKey.trim()) {
    nextKey = raw.apiKey.trim();
    if (nextKey.length > 1024 || /[\r\n]/.test(nextKey))
      throw new Error("API Key 格式不正确。");
    if (!(await encryptionReady()))
      throw new Error("Windows 密钥加密暂时不可用，无法保存 API Key。");
    next.encryptedKey = (await encrypt(nextKey)).toString("base64");
  }
  let registeredNew = false;
  if (next.shortcut !== settings.shortcut || shortcutError) {
    try {
      registeredNew = globalShortcut.register(next.shortcut, togglePet);
    } catch {
      /* handled below */
    }
    if (!registeredNew)
      throw new Error("快捷键已被其他程序占用或格式无效，请换一个组合。");
  }
  try {
    persist(next);
  } catch {
    if (registeredNew) globalShortcut.unregister(next.shortcut);
    throw new Error("设置保存失败，请检查本地磁盘权限。");
  }
  if (registeredNew && next.shortcut !== settings.shortcut)
    globalShortcut.unregister(settings.shortcut);
  const previous = settings;
  settings = next;
  apiKey = nextKey;
  keyProblem = "";
  shortcutError = "";
  pet.setAlwaysOnTop(settings.alwaysOnTop);
  panel?.setAlwaysOnTop(settings.alwaysOnTop);
  if (previous.size !== settings.size) {
    pet.setBounds(petBounds());
    repositionPanel();
  }
  if (app.isPackaged && previous.launchAtLogin !== settings.launchAtLogin)
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  broadcastSettings();
  return publicSettings();
}
function setupIpc() {
  ipcMain.handle("settings:get", (event) =>
    anyTrusted(event) ? publicSettings() : null,
  );
  ipcMain.handle("panel:initial-tab", (event) =>
    trusted(event, "panel") ? panelTab : "chat",
  );
  ipcMain.handle("music:choose", async (event) => {
    if (!trusted(event, "panel")) return { ok: false, error: "请求来源无效。" };
    try {
      const result = await dialog.showOpenDialog(panel, {
        title: localize("选择《白鸟过河滩》音频", settings.locale),
        properties: ["openFile"],
        filters: [
          {
            name: localize("音频文件", settings.locale),
            extensions: ["mp3", "wav", "ogg", "flac", "m4a"],
          },
        ],
      });
      if (result.canceled || !result.filePaths[0]) return { cancelled: true };
      const file = result.filePaths[0],
        ext = path.extname(file).toLowerCase();
      const types = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
      };
      if (!types[ext]) throw new Error("请选择支持的音频格式。");
      const stat = await fs.promises.stat(file);
      if (!stat.isFile() || stat.size > 100 * 1024 * 1024)
        throw new Error("音频文件应小于 100 MB。");
      return {
        ok: true,
        name: path.basename(file),
        type: types[ext],
        bytes: await fs.promises.readFile(file),
      };
    } catch (error) {
      return {
        ok: false,
        error: error.code
          ? "无法读取音频文件，请重新选择。"
          : readableError(error),
      };
    }
  });
  ipcMain.on("music:open-page", (event) => {
    if (trusted(event, "panel"))
      shell
        .openExternal("https://www.bilibili.com/video/BV1wT4y1k7Pw/")
        .catch(() => {});
  });
  ipcMain.on("problem:open", (event) => {
    if (anyTrusted(event)) openProblem();
  });
  ipcMain.on("pet:speak", (event, group) => {
    if (
      anyTrusted(event) &&
      typeof group === "string" &&
      Object.hasOwn(dialogue.groups, group)
    )
      send(pet, "pet:animate", { group });
  });
  ipcMain.handle("settings:save", async (event, raw) => {
    if (!trusted(event, "panel")) return { ok: false, error: "请求来源无效。" };
    try {
      return { ok: true, settings: await saveSettings(raw) };
    } catch (error) {
      return { ok: false, error: readableError(error) };
    }
  });
  ipcMain.handle("api:test", async (event) => {
    if (!trusted(event, "panel")) return { ok: false, error: "请求来源无效。" };
    if (currentRequest)
      return { ok: false, error: "正在回复或测试连接，请稍候。" };
    const controller = new AbortController();
    currentRequest = controller;
    try {
      const result = await requestChat({
        settings: { ...settings, persona: "请只回复：连接成功。" },
        apiKey,
        messages: [{ role: "user", content: "测试连接" }],
        onDelta: () => {},
        signal: controller.signal,
      });
      return { ok: true, text: result.content.slice(0, 160) };
    } catch (error) {
      return { ok: false, error: readableError(error) };
    } finally {
      if (currentRequest === controller) currentRequest = null;
    }
  });
  ipcMain.handle("chat:start", (event, messages) => {
    if (!trusted(event, "panel")) return { ok: false, error: "请求来源无效。" };
    if (currentRequest) return { ok: false, error: "正在回复，请先停止。" };
    if (!apiKey)
      return { ok: false, error: "请先在「设置 → DeepSeek」中填写 API Key。" };
    const controller = new AbortController();
    currentRequest = controller;
    animate("thinking");
    // Defer until the invoke response is delivered, then emit deltas only to the panel.
    setImmediate(async () => {
      try {
        const result = await requestChat({
          settings,
          apiKey,
          messages,
          signal: controller.signal,
          onDelta: (text) => {
            send(panel, "chat:event", { type: "delta", text });
            animate("talk");
          },
        });
        send(panel, "chat:event", {
          type: "done",
          truncated: result.finishReason === "length",
        });
        animate("happy");
      } catch (error) {
        send(panel, "chat:event", {
          type: error.name === "AbortError" ? "stopped" : "error",
          text: readableError(error),
        });
        animate("idle");
      } finally {
        if (currentRequest === controller) currentRequest = null;
      }
    });
    return { ok: true };
  });
  ipcMain.on("chat:stop", (event) => {
    if (trusted(event, "panel")) currentRequest?.abort();
  });
  ipcMain.on("panel:open", (event, tab) => {
    if (anyTrusted(event))
      openPanel(["settings", "music", "play"].includes(tab) ? tab : "chat");
  });
  ipcMain.on("panel:close", (event) => {
    if (trusted(event, "panel")) panel.hide();
  });
  ipcMain.on("pet:hide", (event) => {
    if (anyTrusted(event)) hidePet();
  });
  ipcMain.on("pet:home", (event) => {
    if (anyTrusted(event)) homePet();
  });
  ipcMain.on("pet:action", (event, value) => {
    if (anyTrusted(event)) action(value);
  });
  ipcMain.on("pet:menu", (event) => {
    if (trusted(event, "pet"))
      Menu.buildFromTemplate(menuTemplate()).popup({ window: pet });
  });
  ipcMain.on("pet:drag-start", (event) => {
    if (trusted(event, "pet")) startDrag();
  });
  ipcMain.on("pet:drag-end", (event) => {
    if (trusted(event, "pet")) stopDrag();
  });
  ipcMain.on("pet:ignore-mouse", (event, ignore) => {
    if (trusted(event, "pet") && !drag)
      pet.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", showPet);
  app
    .whenReady()
    .then(async () => {
      await loadSettings();
      session.defaultSession.setPermissionRequestHandler((_, __, callback) =>
        callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      setupIpc();
      createPet();
      createTray();
      try {
        if (!globalShortcut.register(settings.shortcut, togglePet))
          shortcutError = "快捷键被其他程序占用，请在设置中更换。";
      } catch {
        shortcutError = "快捷键注册失败，请在设置中更换。";
      }
      if (shortcutError) openPanel("settings");
      screen.on("display-removed", homePet);
      screen.on("display-metrics-changed", () => {
        if (pet)
          pet.setBounds(
            clampBounds(
              pet.getBounds(),
              screen.getDisplayMatching(pet.getBounds()).workArea,
            ),
          );
        repositionPanel();
      });
    })
    .catch((error) => {
      dialog.showErrorBox("Migrate 启动失败", readableError(error));
      app.quit();
    });
}
app.on("window-all-closed", () => {
  if (quitting) app.quit();
});
app.on("before-quit", () => {
  quitting = true;
  stopDrag();
  stopWalk();
  currentRequest?.abort();
  clearTimeout(saveTimer);
  if (settings) {
    try {
      persist(settings);
    } catch {}
  }
});
app.on("will-quit", () => globalShortcut.unregisterAll());
