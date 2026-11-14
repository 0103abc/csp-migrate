"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const subscribe = (channel, callback) => {
  const listener = (_, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld(
  "migrate",
  Object.freeze({
    getSettings: () => ipcRenderer.invoke("settings:get"),
    getInitialTab: () => ipcRenderer.invoke("panel:initial-tab"),
    saveSettings: (value) => ipcRenderer.invoke("settings:save", value),
    testConnection: () => ipcRenderer.invoke("api:test"),
    chooseMusic: () => ipcRenderer.invoke("music:choose"),
    openMusicPage: () => ipcRenderer.send("music:open-page"),
    openProblem: () => ipcRenderer.send("problem:open"),
    speak: (group) => ipcRenderer.send("pet:speak", group),
    startChat: (messages) => ipcRenderer.invoke("chat:start", messages),
    stopChat: () => ipcRenderer.send("chat:stop"),
    openPanel: (tab) => ipcRenderer.send("panel:open", tab),
    closePanel: () => ipcRenderer.send("panel:close"),
    hide: () => ipcRenderer.send("pet:hide"),
    home: () => ipcRenderer.send("pet:home"),
    action: (action) => ipcRenderer.send("pet:action", action),
    menu: () => ipcRenderer.send("pet:menu"),
    dragStart: () => ipcRenderer.send("pet:drag-start"),
    dragEnd: () => ipcRenderer.send("pet:drag-end"),
    ignoreMouse: (ignore) => ipcRenderer.send("pet:ignore-mouse", ignore),
    onSettings: (callback) => subscribe("settings:updated", callback),
    onAction: (callback) => subscribe("pet:animate", callback),
    onPanel: (callback) => subscribe("panel:tab", callback),
    onChat: (callback) => subscribe("chat:event", callback),
  }),
);
