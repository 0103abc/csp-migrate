"use strict";
const { test, expect } = require("@playwright/test"),
  { _electron } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
test("head hovering, blinking, jumping, doorway shoes and Taiwan language behave together", async () => {
  const scratch = path.resolve(
      root,
      "../../work/expressions-" + crypto.randomUUID(),
    ),
    userData = path.join(scratch, "userdata");
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(
    path.join(userData, "settings.json"),
    JSON.stringify({
      ...require("../src/core.cjs").DEFAULTS,
      shortcut: "Ctrl+Alt+F12",
      alwaysOnTop: false,
      autoActions: false,
      contestReminders: false,
    }),
  );
  const app = await _electron.launch({
    ...(process.env.MIGRATE_TEST_EXE
      ? { executablePath: path.resolve(process.env.MIGRATE_TEST_EXE) }
      : { args: [root] }),
    env: {
      ...process.env,
      MIGRATE_PASSIVE_TEST: "1",
      MIGRATE_USER_DATA: userData,
    },
  });
  const errors = [];
  try {
    const pet = await app.firstWindow();
    pet.on("pageerror", (e) => errors.push(e.message));
    await pet.waitForLoadState();
    await expect(pet.locator("#sprite")).toHaveAttribute("src", /idle\.png/);
    expect(
      await pet.evaluate(async () => {
        await turnPlayer.ready;
        for (const [p, name] of [
          [0, "idle"],
          [1, "back"],
        ]) {
          const original = new Image();
          original.src = `../assets/${name}.png`;
          await original.decode();
          const expected = document.createElement("canvas");
          expected.width = 640;
          expected.height = 654;
          const scale = 654 / original.naturalHeight,
            w = original.naturalWidth * scale;
          expected
            .getContext("2d")
            .drawImage(original, (640 - w) / 2, 0, w, 654);
          turnPlayer.drawAt(p);
          const actual = document
              .querySelector("#turn-canvas")
              .getContext("2d")
              .getImageData(0, 0, 640, 654).data,
            reference = expected
              .getContext("2d")
              .getImageData(0, 0, 640, 654).data;
          if (
            !actual.every(
              (value, index) => Math.abs(value - reference[index]) <= 1,
            )
          )
            return false;
        }
        return true;
      }),
    ).toBe(true);
    const hover = async (x, y) =>
      pet.evaluate(
        ({ x, y }) => {
          const el = document.querySelector("#pet"),
            r = el.getBoundingClientRect();
          el.dispatchEvent(
            new PointerEvent("pointermove", {
              bubbles: true,
              clientX: r.left + (x * r.width) / 232,
              clientY: r.top + (y * r.height) / 327,
            }),
          );
        },
        { x, y },
      );
    await hover(120, 240);
    await pet.waitForTimeout(450);
    expect(await pet.evaluate(() => active)).toBe("idle");
    await hover(120, 100);
    await expect.poll(() => pet.evaluate(() => active)).toBe("headpat");
    await expect(pet.locator("#pet")).toHaveClass(/head-motion/);
    await pet.evaluate(() => {
      for (const a of document.querySelector("#head-rig").getAnimations()) {
        a.pause();
        a.currentTime = 1000;
      }
    });
    await pet.screenshot({
      path: path.join(scratch, "headpat.png"),
      omitBackground: true,
    });
    await expect.poll(() => pet.evaluate(() => active)).toBe("idle");
    await hover(120, 240);
    await hover(120, 100);
    await pet.waitForTimeout(500);
    expect(await pet.evaluate(() => active)).toBe("idle");
    await pet.evaluate(() => {
      headInside = false;
      dragStart = { x: 0, y: 0 };
      lastHeadPat = -Infinity;
    });
    await hover(120, 100);
    await pet.waitForTimeout(450);
    expect(await pet.evaluate(() => active)).toBe("idle");
    await pet.evaluate(() => {
      dragStart = null;
      headInside = false;
    });
    await pet.evaluate(() => window.migrate.action("blink"));
    await expect(pet.locator("#pet")).toHaveClass(/eyes-closed/);
    await pet.evaluate(() => {
      faceTimers.forEach(clearTimeout);
    });
    await pet.screenshot({
      path: path.join(scratch, "blink.png"),
      omitBackground: true,
    });
    await expect(pet.locator(".blink-eyes")).toHaveCSS("opacity", "1");
    await expect(pet.locator("#head-sprite")).toHaveCSS("opacity", "0");
    await pet.evaluate(() => perform("idle"));
    const baseline = await pet.locator("#pet").boundingBox();
    await pet.evaluate(() => window.migrate.action("jump"));
    await expect(pet.locator("#pet")).toHaveClass(/jump/);
    await pet.evaluate(() => {
      for (const a of document.querySelector("#pet").getAnimations()) {
        a.pause();
        a.currentTime = 850;
      }
    });
    const airborne = await pet.locator("#pet").boundingBox();
    expect(airborne.y).toBeLessThan(baseline.y - 28);
    expect(airborne.y).toBeGreaterThanOrEqual(0);
    await pet.screenshot({
      path: path.join(scratch, "jump.png"),
      omitBackground: true,
    });
    await pet.evaluate(() => perform("idle"));
    const next = app.waitForEvent("window");
    await pet.evaluate(() => window.migrate.openPanel("play"));
    const panel = await next;
    panel.on("pageerror", (e) => errors.push(e.message));
    await panel.waitForLoadState();
    await expect(panel.locator("[data-action]")).toHaveCount(20);
    await panel.locator('[data-scene="home"]').click();
    await panel.evaluate(() => {
      scenePlayer.state.elapsed = 12300;
    });
    await expect(panel.locator(".scene-character.visible")).toHaveAttribute(
      "src",
      /remove-shoe/,
    );
    await panel.evaluate(() => {
      scenePlayer.state.elapsed = 15300;
    });
    await expect(panel.locator(".scene-character.visible")).toHaveAttribute(
      "src",
      /place-shoes/,
    );
    await expect(panel.locator(".scene-stage")).toHaveAttribute(
      "data-shoes",
      "outside",
    );
    await panel.evaluate(() => {
      scenePlayer.state.elapsed = 21500;
    });
    await expect(panel.locator(".scene-character.visible")).toHaveAttribute(
      "src",
      /home-welcome/,
    );
    await expect(panel.locator(".scene-stage")).toHaveAttribute(
      "data-shoes",
      "off",
    );
    await expect(panel.locator(".scene-entry")).toHaveCSS("opacity", "1");
    await panel.locator('[data-control="pause"]').click();
    await panel.screenshot({ path: path.join(scratch, "home-shoes.png") });
    await panel.locator('[data-control="end"]').click();
    await panel.locator('[data-tab="settings"]').click();
    await panel.locator("#locale").selectOption("zh-TW");
    await panel.locator("#save-settings").click();
    await expect(panel.locator("html")).toHaveAttribute("lang", "zh-TW");
    await expect(panel.locator("#save-settings")).toHaveText("儲存設定");
    await expect(panel.locator("#locale option")).toHaveCount(3);
    await app.evaluate(({ shell }) => {
      globalThis.openedProblem = "";
      shell.openExternal = async (url) => {
        globalThis.openedProblem = url;
      };
    });
    await panel.locator('[data-tab="play"]').click();
    await panel.locator("#open-problem").click();
    await expect
      .poll(() => app.evaluate(() => globalThis.openedProblem))
      .toBe("https://qoj.ac/problem/24562/statement/zh_tw");
    const prefs = await panel.evaluate(() => window.migrate.getSettings());
    expect(prefs.locale).toBe("zh-TW");
    expect(prefs.lively).toBe(true);
    await panel.locator("#play-tab").evaluate((el) => (el.scrollTop = 0));
    await panel.screenshot({ path: path.join(scratch, "play-tw.png") });
    expect(errors).toEqual([]);
    fs.writeFileSync(
      path.resolve(root, "../../work/latest-expressions-test.json"),
      JSON.stringify({ scratch, errors }),
    );
  } finally {
    await app.close();
  }
});
