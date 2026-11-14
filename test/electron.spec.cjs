"use strict";
const { test, expect } = require("@playwright/test");
const { _electron } = require("playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
test("desktop, settings encryption, streaming chat, stop, music and persistence", async () => {
  const scratch = path.resolve(root, "../../work/e2e-" + crypto.randomUUID());
  fs.mkdirSync(scratch, { recursive: true });
  fs.mkdirSync(path.join(scratch, "userdata"));
  fs.writeFileSync(
    path.join(scratch, "userdata/settings.json"),
    JSON.stringify({
      ...require("../src/core.cjs").DEFAULTS,
      shortcut: "Ctrl+Alt+F11",
      alwaysOnTop: false,
      autoActions: false,
    }),
  );
  const requests = [],
    errors = [];
  const server = http.createServer(async (request, response) => {
    const body = [];
    for await (const chunk of request) body.push(chunk);
    const payload = JSON.parse(Buffer.concat(body).toString());
    requests.push({ auth: request.headers.authorization, payload });
    if (request.headers.authorization === "Bearer fake-denied") {
      response.writeHead(401);
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    const slow = payload.messages.at(-1).content === "慢一点";
    response.write(
      `data: ${JSON.stringify({ choices: [{ delta: { content: slow ? "慢慢说，" : "海风你好。" } }] })}\n\n`,
    );
    const timer = setTimeout(
      () => {
        response.end(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "我在这里。" }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
        );
      },
      slow ? 10000 : 120,
    );
    request.on("close", () => {
      if (response.destroyed) clearTimeout(timer);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let app;
  const watch = (page) => {
    page.on("pageerror", (error) => errors.push(error.message));
  };
  try {
    app = await _electron.launch({
      args: [root],
      env: {
        ...process.env,
        MIGRATE_USER_DATA: path.join(scratch, "userdata"),
      },
    });
    const pet = await app.firstWindow();
    watch(pet);
    await pet.waitForLoadState();
    await expect(pet.locator("#sprite")).toBeVisible();
    expect(await pet.locator("#pet").evaluate(element => getComputedStyle(element).animationName)).toBe("quietbreath");
    expect(await pet.evaluate(() => typeof require)).toBe("undefined");
    const initial = await app.evaluate(
      ({ BrowserWindow, screen, globalShortcut }) => ({
        bounds: BrowserWindow.getAllWindows()[0].getBounds(),
        area: screen.getPrimaryDisplay().workArea,
        registered: globalShortcut.isRegistered("Ctrl+Alt+F11"),
      }),
    );
    expect(initial.registered).toBe(true);
    expect(initial.bounds.x + initial.bounds.width).toBeLessThanOrEqual(
      initial.area.x + initial.area.width,
    );
    await pet.evaluate(() => window.migrate.action("turn"));
    await expect
      .poll(() =>
        pet
          .locator("#turn-sprite")
          .evaluate((element) => element.getAnimations().length),
      )
      .toBeGreaterThan(0);
    await pet.evaluate(() => {
      window.migrate.action("turn");
      window.migrate.action("turn");
    });
    await expect(pet.locator("#sprite")).toHaveAttribute("src", /back\.png/, {
      timeout: 3000,
    });
    await expect
      .poll(() =>
        pet
          .locator("#pet")
          .evaluate((element) => element.classList.contains("turning")),
      )
      .toBe(false);
    await pet.evaluate(() => window.migrate.action("turn"));
    await expect(pet.locator("#sprite")).toHaveAttribute("src", /idle\.png/);
    const panelPromise = app.waitForEvent("window");
    await pet.evaluate(() => window.migrate.openPanel("settings"));
    const panel = await panelPromise;
    watch(panel);
    await panel.waitForLoadState();
    await expect(panel.locator("#settings-tab")).toBeVisible();
    await expect(panel.locator("#locale")).toHaveValue("zh-CN");
    await panel.locator("#api-key").fill("fake-ui-test-key");
    await panel.locator("#base-url").fill(baseUrl);
    await panel.locator("#auto-actions").uncheck();
    await panel.locator("#test-api").click();
    await expect(panel.locator("#toast")).toContainText("连接成功", {
      timeout: 15000,
    });
    expect(requests[0].auth).toBe("Bearer fake-ui-test-key");
    const disk = fs.readFileSync(
      path.join(scratch, "userdata/settings.json"),
      "utf8",
    );
    expect(disk).not.toContain("fake-ui-test-key");
    expect(JSON.parse(disk).encryptedKey.length).toBeGreaterThan(50);
    const publicConfig = await panel.evaluate(() =>
      window.migrate.getSettings(),
    );
    expect(publicConfig.hasKey).toBe(true);
    expect(publicConfig.encryptedKey).toBeUndefined();
    expect(publicConfig.apiKey).toBeUndefined();
    await panel.locator("#locale").selectOption("zh-HK");
    await panel.locator("#save-settings").click();
    await expect(panel.locator("html")).toHaveAttribute("lang", "zh-HK");
    await expect(panel.locator('[data-tab="settings"]')).toContainText("設定");
    await expect(panel.locator("#toast")).toContainText("設定已保存");
    await panel.screenshot({ path: path.join(scratch, "settings-hk.png") });
    await panel.locator("#test-api").click();
    await expect(panel.locator("#toast")).toContainText("連線成功");
    expect(requests.at(-1).payload.messages[0].content).toContain(
      "繁體中文（香港）",
    );
    await panel.locator("#locale").selectOption("zh-CN");
    await panel.locator("#save-settings").click();
    await expect(panel.locator('[data-tab="settings"]')).toContainText("设置");
    await panel.locator('[data-tab="play"]').click();
    await expect(panel.locator("[data-action]")).toHaveCount(17);
    await expect(panel.locator("#dialogue-group option")).toHaveCount(30);
    await panel.locator('[data-action="birds"]').click();
    await expect(pet.locator("#pet")).toHaveClass(/birds/);
    await panel.locator("#dialogue-group").selectOption("encourage");
    await panel.locator("#speak-line").click();
    await expect(pet.locator("#bubble")).toContainText(/。/);
    await app.evaluate(({ shell }) => {
      globalThis.openedUrls = [];
      shell.openExternal = async (url) => {
        globalThis.openedUrls.push(url);
      };
    });
    await panel.locator("#open-problem").click();
    await expect
      .poll(() => app.evaluate(() => globalThis.openedUrls.at(-1)))
      .toBe("https://qoj.ac/problem/24562/statement/zh_cn");
    await panel.locator("#play-tab").evaluate(element => { element.scrollTop = 0; });
    await panel.screenshot({ path: path.join(scratch, "play.png") });
    await panel.locator('[data-action="magic"]').click();
    await expect(pet.locator("#sprite")).toHaveAttribute("src", /sleep\.png/);
    await expect(pet.locator("#sprite")).toHaveAttribute("src", /magic\.png/);
    await pet.screenshot({ path: path.join(scratch, "pet.png"), omitBackground: true });
    await panel.locator('[data-tab="chat"]').click();
    await panel.locator("#message-input").fill("你好");
    await panel.locator("#send").click();
    await expect(panel.locator(".message.assistant .body").last()).toHaveText(
      "海风你好。我在这里。",
    );
    await expect(panel.locator("#send")).toBeVisible();
    await panel.locator("#message-input").fill("慢一点");
    await panel.locator("#send").click();
    await expect(
      panel.locator(".message.assistant .body").last(),
    ).toContainText("慢慢说");
    await panel.locator("#stop").click();
    await expect(panel.locator("#send")).toBeVisible();
    // Capture the real app UI without personal desktop content or real credentials.
    await panel.screenshot({ path: path.join(scratch, "chat.png") });
    await panel.locator('[data-tab="settings"]').click();
    await panel.locator("#api-key").fill("fake-denied");
    await panel.locator("#test-api").click();
    await expect(panel.locator("#toast")).toContainText("密钥无效");
    await panel.locator("#api-key").fill("fake-ui-test-key");
    await panel.locator("#shortcut").fill("Ctrl+Shift+F8");
    await panel.locator("#save-settings").click();
    await expect(panel.locator("#toast")).toContainText("设置已保存");
    expect(
      await app.evaluate(
        ({ globalShortcut }) =>
          globalShortcut.isRegistered("Ctrl+Shift+F8") &&
          !globalShortcut.isRegistered("Ctrl+Alt+F11"),
      ),
    ).toBe(true);
    // A generated test tone verifies local decode/playback without bundling music.
    const wave = Buffer.alloc(44 + 16000);
    wave.write("RIFF");
    wave.writeUInt32LE(wave.length - 8, 4);
    wave.write("WAVEfmt ", 8);
    wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(1, 20);
    wave.writeUInt16LE(1, 22);
    wave.writeUInt32LE(8000, 24);
    wave.writeUInt32LE(16000, 28);
    wave.writeUInt16LE(2, 32);
    wave.writeUInt16LE(16, 34);
    wave.write("data", 36);
    wave.writeUInt32LE(16000, 40);
    const audioFile = path.join(scratch, "test-tone.wav");
    fs.writeFileSync(audioFile, wave);
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, audioFile);
    await panel.locator('[data-tab="music"]').click();
    await panel.locator("#choose-music").click();
    await expect(panel.locator("#music-file")).toHaveText("test-tone.wav");
    await expect
      .poll(() =>
        panel.locator("#local-audio").evaluate((audio) => audio.readyState),
      )
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(() =>
        panel.locator("#local-audio").evaluate((audio) => audio.paused),
      )
      .toBe(false);
    await panel.locator("#local-audio").evaluate((audio) => audio.pause());
    // Verify the online player is on the intended provider without relying on network availability.
    await panel.route("https://player.bilibili.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Test player</title>",
      }),
    );
    await panel.locator("#play-original").click();
    await expect(panel.locator("#music-video")).toHaveAttribute(
      "src",
      /BV1wT4y1k7Pw/,
    );
    await panel.locator("#stop-original").click();
    await expect(panel.locator("#video-wrap")).toBeHidden();
    await panel.locator("#close").click();
    await pet.evaluate(() => window.migrate.hide());
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().every((win) => !win.isVisible()),
      ),
    ).toBe(true);
    await app.close();
    app = null;
    app = await _electron.launch({
      args: [root],
      env: {
        ...process.env,
        MIGRATE_USER_DATA: path.join(scratch, "userdata"),
      },
    });
    const restored = await app.firstWindow();
    await restored.waitForLoadState();
    const config = await restored.evaluate(() => window.migrate.getSettings());
    expect(config.hasKey).toBe(true);
    expect(config.shortcut).toBe("Ctrl+Shift+F8");
    expect(errors).toEqual([]);
    fs.writeFileSync(
      path.resolve(root, "../../work/latest-ui-test.json"),
      JSON.stringify(
        {
          scratch,
          assertions: "UI + DPAPI + chat SSE + cancellation + music + restart",
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
