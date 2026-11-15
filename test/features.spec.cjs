"use strict";
const { test, expect } = require("@playwright/test"),
  { _electron } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
test("16-angle turns, local time dialogue and hidden-pet contest reminders work without credentials", async () => {
  const scratch = path.resolve(
      root,
      "../../work/features-" + crypto.randomUUID(),
    ),
    userData = path.join(scratch, "userdata");
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(
    path.join(userData, "settings.json"),
    JSON.stringify({
      ...require("../src/core.cjs").DEFAULTS,
      shortcut: "Ctrl+Alt+F10",
      autoActions: false,
      alwaysOnTop: false,
      contestReminders: false,
    }),
  );
  const app = await _electron.launch({
    ...(process.env.MIGRATE_TEST_EXE
      ? { executablePath: path.resolve(process.env.MIGRATE_TEST_EXE) }
      : { args: [root] }),
    env: {
      ...process.env,
      MIGRATE_USER_DATA: userData,
      MIGRATE_PASSIVE_TEST: "1",
    },
  });
  const errors = [];
  try {
    const pet = await app.firstWindow();
    pet.on("pageerror", (e) => errors.push(e.message));
    await pet.waitForLoadState();
    const frames = await pet.evaluate(async () => {
      const capture = new Set();
      window.migrate.action("turn");
      await new Promise((resolve) => {
        const start = performance.now();
        function tick() {
          const c = document.querySelector("#turn-canvas");
          if (Number(c.dataset.progress) > 0)
            capture.add(Number(c.dataset.frame));
          if (performance.now() - start > 1900) resolve();
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
      return [...capture];
    });
    expect(frames.length).toBeGreaterThanOrEqual(12);
    await expect(pet.locator("#sprite")).toHaveAttribute("src", /back\.png/);
    await pet.evaluate(() => window.migrate.action("turn"));
    await expect
      .poll(() =>
        pet.locator("#turn-canvas").evaluate((c) => Number(c.dataset.progress)),
      )
      .toBeGreaterThan(0.2);
    await pet.screenshot({
      path: path.join(scratch, "turn-middle.png"),
      omitBackground: true,
    });
    await expect.poll(() => pet.evaluate(() => turning)).toBe(false);
    await expect(pet.locator("#sprite")).toHaveAttribute("src", /standing-front\.png/);
    await pet.evaluate(() => window.migrate.action("turn"));
    await expect.poll(() => pet.evaluate(() => turning)).toBe(true);
    await pet.evaluate(() => window.migrate.action("wave"));
    await expect(pet.locator("#turn-canvas")).toHaveCSS("opacity", "0");
    await expect(pet.locator("#sprite")).toHaveCSS("opacity", "1");
    await expect(pet.locator("#pet")).not.toHaveClass(/turning/);
    await pet.evaluate(() => window.migrate.action("looksea"));
    await expect(pet.locator("#pet")).toHaveClass(/looksea.*turning/);
    await expect(pet.locator("#sprite")).toHaveAttribute("src", /back\.png/);
    await expect(pet.locator("#sprite")).toHaveAttribute("src", /standing-front\.png/, {
      timeout: 7000,
    });
    await pet.evaluate(() => window.migrate.action("idle"));
    const next = app.waitForEvent("window");
    await pet.evaluate(() => window.migrate.openPanel("play"));
    const panel = await next;
    panel.on("pageerror", (e) => errors.push(e.message));
    await panel.waitForLoadState();
    await expect(panel.locator("#dialogue-count")).toContainText("460");
    await panel.locator("#dialogue-group").selectOption("hourly");
    await panel.locator("#speak-line").click();
    await expect(pet.locator("#bubble")).toContainText(/\d{2}:\d{2}/);
    await expect(pet.locator("#bubble")).not.toContainText("{time}");
    await app.evaluate(({ net, shell }) => {
      globalThis.scheduleRequests = [];
      globalThis.contestUrls = [];
      shell.openExternal = async (url) => globalThis.contestUrls.push(url);
      net.fetch = async (url, options) => {
        globalThis.scheduleRequests.push({
          url,
          headers: options.headers,
          credentials: options.credentials,
        });
        const start = Date.now() + 240000;
        if (url.includes("codeforces"))
          return Response.json({
            status: "OK",
            result: [
              {
                id: 99999,
                name: "Test CF Round",
                phase: "BEFORE",
                startTimeSeconds: Math.floor(start / 1000),
                durationSeconds: 7200,
              },
            ],
          });
        const iso = new Date(start).toISOString();
        return new Response(
          `<div id="contest-table-upcoming"><table><tbody><tr><td><time>${iso}</time></td><td><a href="/contests/abc-test">Test AtCoder Contest</a></td><td>01:40</td></tr></tbody></table></div>`,
        );
      };
    });
    const reminderPromise = app.waitForEvent("window");
    await pet.evaluate(() => window.migrate.hide());
    const saved = await panel.evaluate(() =>
      window.migrate.saveSettings({ contestReminders: true }),
    );
    expect(saved.ok).toBe(true);
    const reminder = await reminderPromise;
    reminder.on("pageerror", (e) => errors.push(e.message));
    await reminder.waitForLoadState();
    await expect(reminder.locator("#names")).toContainText("Test CF Round");
    await expect(reminder.locator("#names")).toContainText(
      "Test AtCoder Contest",
    );
    expect(
      await reminder.evaluate(() => window.migrate.getSettings()),
    ).toBeNull();
    expect(await pet.evaluate(() => window.migrate.getReminder())).toBeNull();
    const invisiblePet = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith("/pet.html"),
      );
      return !win.isVisible();
    });
    expect(invisiblePet).toBe(true);
    await reminder.screenshot({
      path: path.join(scratch, "contest-reminder.png"),
    });
    await reminder.locator("#view").click();
    await expect(panel.locator("#contests-tab")).toBeVisible();
    await expect(panel.locator(".contest-card")).toHaveCount(2);
    await panel.locator(".contest-card button").first().click();
    expect(await app.evaluate(() => globalThis.contestUrls[0])).toMatch(
      /^https:\/\/(codeforces.com\/contest\/99999|atcoder.jp\/contests\/abc-test)$/,
    );
    await panel.screenshot({ path: path.join(scratch, "contests.png") });
    const requests = await app.evaluate(() => globalThis.scheduleRequests);
    expect(requests).toHaveLength(2);
    requests.forEach((r) => {
      expect(r.credentials).toBe("omit");
      expect(Object.keys(r.headers)).toEqual(["Accept"]);
    });
    expect(
      JSON.parse(
        fs.readFileSync(path.join(userData, "contest-cache.json"), "utf8"),
      ).notified,
    ).toHaveLength(2);
    await panel.locator('[data-tab="settings"]').click();
    await panel.locator("#contest-reminders").uncheck();
    await panel.locator("#time-aware").uncheck();
    await panel.locator("#save-settings").click();
    await expect
      .poll(() =>
        panel.evaluate(() =>
          window.migrate.getSettings().then((s) => s.contestReminders),
        ),
      )
      .toBe(false);
    await panel.locator('[data-tab="contests"]').click();
    await expect(panel.locator("#contest-status")).toContainText("提醒已关闭");
    await panel.locator('[data-tab="settings"]').click();
    await panel.locator("#locale").selectOption("zh-HK");
    await panel.locator("#save-settings").click();
    await expect(panel.locator("#contest-reminders")).not.toBeChecked();
    await expect(panel.locator("#time-aware")).not.toBeChecked();
    await panel.locator('[data-tab="contests"]').click();
    await expect(panel.locator("#contest-status")).toContainText("提醒已關閉");
    expect(errors).toEqual([]);
    fs.writeFileSync(
      path.resolve(root, "../../work/latest-features-test.json"),
      JSON.stringify({ scratch, frames: frames.length, errors }),
    );
  } finally {
    await app.close();
  }
});
