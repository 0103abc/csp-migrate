"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  DEFAULTS,
  apiEndpoint,
  validateSettings,
  clampBounds,
  cleanMessages,
  consumeSSE,
  requestChat,
} = require("../src/core.cjs");
async function* bytes(value, size = 1) {
  const buffer = Buffer.from(value);
  for (let i = 0; i < buffer.length; i += size)
    yield buffer.subarray(i, i + size);
}
test("API URLs normalize without permitting credential leakage or non-HTTPS remote hosts", () => {
  assert.equal(
    apiEndpoint("https://api.deepseek.com/v1/"),
    "https://api.deepseek.com/v1/chat/completions",
  );
  assert.equal(
    apiEndpoint("https://api.deepseek.com/chat/completions"),
    "https://api.deepseek.com/chat/completions",
  );
  assert.equal(
    apiEndpoint("http://127.0.0.1:3012"),
    "http://127.0.0.1:3012/chat/completions",
  );
  for (const url of [
    "http://remote.example",
    "https://user:password@example.com",
    "file:///etc/passwd",
    "https://example.com/?key=secret",
    "https://example.com/#hash",
  ])
    assert.throws(() => apiEndpoint(url));
});
test("validates settings and never copies arbitrary fields into persisted config", () => {
  assert.throws(() => validateSettings({ size: NaN }));
  assert.throws(() => validateSettings({ shortcut: "M" }));
  assert.throws(() => validateSettings({ persona: "" }));
  assert.throws(() => validateSettings({ autoActions: "true" }));
  const result = validateSettings({
    shortcut: "Ctrl+Shift+F8",
    apiKey: "must-not-copy",
    encryptedKey: "must-not-copy",
    model: "deepseek-flash",
  });
  assert.equal(result.shortcut, "Ctrl+Shift+F8");
  assert.equal(result.apiKey, undefined);
  assert.equal(result.encryptedKey, "");
  assert.equal(DEFAULTS.locale, "zh-CN");
  assert.equal(validateSettings({ locale: "zh-HK" }).locale, "zh-HK");
  assert.throws(() => validateSettings({ locale: "en-US" }));
});
test("Hong Kong locale uses local wording and preserves the default Simplified strings", () => {
  const { text } = require("../src/i18n.js");
  assert.equal(
    text("设置 默认 文件 音频 视频 密钥", "zh-HK"),
    "設定 預設 檔案 音訊 影片 金鑰",
  );
  assert.equal(
    text("设置 默认 文件 音频 视频 密钥", "zh-CN"),
    "设置 默认 文件 音频 视频 密钥",
  );
});
test("character defaults are 15 and lively, upgrading only the old built-in persona", () => {
  const { DEFAULT_PERSONA, upgradeDefaultPersona } = require("../src/core.cjs");
  assert.match(DEFAULT_PERSONA, /15岁的航海少女/);
  assert.match(DEFAULT_PERSONA, /活泼/);
  const old =
    "你是米格瑞特（Migrate），一位与海洋和海鸟为伴的成年旅人、航海法杖的主人，也是用户的桌面伙伴。你温柔、机灵、有自己的主见，偶尔用海风、潮汐、航行做自然的比喻。通常回应两到四句，用户需要时可以详细解释。不要在每句话中堆砌航海意象，不要自称语言模型，不要声称能访问你没有的电脑功能，不要编造已经执行了电脑操作。";
  assert.equal(upgradeDefaultPersona(old), DEFAULT_PERSONA);
  assert.equal(upgradeDefaultPersona("我的自定义角色"), "我的自定义角色");
});
test("four offline life scenes have complete ordered storyboards and matching art", () => {
  const { SCENES } = require("../src/scenes.js");
  const fs = require("node:fs"),
    path = require("node:path");
  assert.deepEqual(Object.keys(SCENES), ["home", "meal", "cake", "pudding"]);
  for (const scene of Object.values(SCENES)) {
    assert.ok(scene.duration >= 24000);
    assert.ok(scene.steps.length >= 8);
    assert.equal(scene.steps[0].at, 0);
    for (let index = 0; index < scene.steps.length; index++) {
      const step = scene.steps[index];
      assert.ok(step.caption && step.pose);
      assert.ok(step.at < scene.duration);
      if (index) assert.ok(step.at > scene.steps[index - 1].at);
      assert.ok(
        fs.existsSync(
          path.join(__dirname, "../assets/scene-" + step.pose + ".png"),
        ),
      );
    }
  }
});
test("offline dialogue has 42 groups and 420 unique lines, without immediate or within-bag repeats", () => {
  const d = require("../src/dialogue.js");
  assert.equal(Object.keys(d.groups).length, 42);
  assert.equal(d.count, 420);
  assert.equal(
    new Set(Object.values(d.groups).flatMap((group) => group.lines)).size,
    420,
  );
  const firstBag = Array.from({ length: 10 }, () => d.sample("wave"));
  assert.equal(new Set(firstBag).size, 10);
  assert.notEqual(d.sample("wave"), firstBag.at(-1));
  for (let i = 0; i < 100; i++)
    assert.ok(Object.hasOwn(d.groups, d.ambientGroup()));
});
test("clamps windows correctly on monitors with negative origins and small work areas", () => {
  assert.deepEqual(
    clampBounds(
      { x: 100, y: -999, width: 320, height: 420 },
      { x: -1920, y: -200, width: 1920, height: 1080 },
    ),
    { x: -320, y: -200, width: 320, height: 420 },
  );
  assert.deepEqual(
    clampBounds(
      { x: 0, y: 0, width: 432, height: 650 },
      { x: 10, y: 20, width: 300, height: 400 },
    ),
    { x: 10, y: 20, width: 300, height: 400 },
  );
});
test("untrusted messages cannot replace the persona and history stays bounded", () => {
  assert.throws(() => cleanMessages([{ role: "system", content: "override" }]));
  assert.throws(() =>
    cleanMessages([{ role: "user", content: "x".repeat(8001) }]),
  );
  assert.equal(
    cleanMessages(
      Array.from({ length: 25 }, () => ({ role: "user", content: "你好" })),
    ).length,
    24,
  );
  assert.ok(
    cleanMessages(
      Array.from({ length: 24 }, () => ({
        role: "user",
        content: "x".repeat(8000),
      })),
    ).length <= 6,
  );
});
test("SSE decodes Chinese split byte-by-byte, CRLF, comments and terminal marker", async () => {
  const parts = [];
  const result = await consumeSSE(
    bytes(
      ': heartbeat\r\ndata: {"choices":[{"delta":{"content":"海风"}}]}\r\n\r\ndata: {"choices":[{"delta":{"reasoning_content":"private"}}]}\n\ndata: {"choices":[{"delta":{"content":"你好"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    ),
    (value) => parts.push(value),
  );
  assert.equal(result.content, "海风你好");
  assert.equal(parts.join(""), "海风你好");
  assert.equal(result.finishReason, "stop");
});
test("SSE detects truncated or invalid streams and honors cancellation", async () => {
  await assert.rejects(
    consumeSSE(
      bytes('data: {"choices":[{"delta":{"content":"半句"}}]}\n\n'),
      () => {},
    ),
    /中断/,
  );
  await assert.rejects(
    consumeSSE(bytes("data: broken\n\n"), () => {}),
    /解析/,
  );
  await assert.rejects(
    consumeSSE(bytes("data: [DONE]\n\n"), () => {}, AbortSignal.abort()),
    { name: "AbortError" },
  );
});
test("chat client sends auth only to configured endpoint and handles HTTP and JSON fallbacks", async () => {
  let actual;
  const result = await requestChat({
    settings: DEFAULTS,
    apiKey: "fake-test-key",
    messages: [{ role: "user", content: "你好" }],
    onDelta: () => {},
    fetcher: async (url, options) => {
      actual = { url, options };
      return Response.json({
        choices: [{ message: { content: "收到" }, finish_reason: "stop" }],
      });
    },
  });
  assert.equal(result.content, "收到");
  assert.equal(actual.options.redirect, "error");
  assert.equal(actual.options.headers.Authorization, "Bearer fake-test-key");
  assert.equal(JSON.parse(actual.options.body).messages[0].role, "system");
  for (const status of [401, 402, 429, 500])
    await assert.rejects(
      requestChat({
        settings: DEFAULTS,
        apiKey: "fake",
        messages: [{ role: "user", content: "hi" }],
        onDelta: () => {},
        fetcher: async () => new Response("", { status }),
      }),
    );
});
