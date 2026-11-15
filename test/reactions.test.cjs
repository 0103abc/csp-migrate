"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  path = require("node:path");
const { isHeadPoint } = require("../src/reactions.js");
test("head hit region covers hair and hat while excluding skirt, feet and transparent corners", () => {
  assert.equal(isHeadPoint(120, 85), true);
  assert.equal(isHeadPoint(135, 130), true);
  assert.equal(isHeadPoint(120, 240), false);
  assert.equal(isHeadPoint(20, 10), false);
  assert.equal(isHeadPoint(230, 80), false);
});
test("standing sprites exactly match the turn endpoints including all colors and transparency", async () => {
  const sharp = require("sharp"),
    dir = path.resolve(__dirname, "../assets");
  for (const [index, name] of [
    [0, "standing-front"],
    [15, "standing-back"],
  ]) {
    const expected = await sharp(path.join(dir, "turn-strip.png"))
      .extract({ left: index * 640, top: 0, width: 640, height: 654 })
      .raw()
      .toBuffer();
    const actual = await sharp(path.join(dir, name + ".png"))
      .raw()
      .toBuffer();
    assert.ok(actual.equals(expected), name + " differs from turn endpoint");
  }
});
test("Taiwan conversion uses local phrases and API requests receive the selected language", async () => {
  const { text } = require("../src/i18n.js"),
    { DEFAULTS, requestChat } = require("../src/core.cjs");
  assert.equal(
    text("默认 软件 鼠标 文件 视频 音频 内存 网络 保存 设置 密钥", "zh-TW"),
    "預設 軟體 滑鼠 檔案 影片 音訊 記憶體 網路 儲存 設定 金鑰",
  );
  let body;
  await requestChat({
    settings: { ...DEFAULTS, locale: "zh-TW" },
    apiKey: "fake-tw-test",
    messages: [{ role: "user", content: "你好" }],
    onDelta: () => {},
    fetcher: async (_, options) => {
      body = JSON.parse(options.body);
      return Response.json({
        choices: [{ message: { content: "你好呀！" }, finish_reason: "stop" }],
      });
    },
  });
  assert.match(body.messages[0].content, /繁體中文（台灣）/);
  assert.match(body.messages[0].content, /滑鼠/);
});
test("home story takes boots off outside before entering, and stays barefoot indoors", () => {
  const { SCENES } = require("../src/scenes.js"),
    steps = SCENES.home.steps;
  const enter = steps.findIndex((s) => s.bg === "home"),
    remove = steps.findIndex((s) => s.shoes === "removing"),
    place = steps.findIndex((s) => s.shoes === "outside");
  assert.ok(remove > 0 && place > remove && enter > place);
  for (const step of steps.slice(enter))
    assert.equal(step.pose, "home-welcome");
  assert.equal(steps[enter].shoes, "off");
});
