"use strict";
const { test, expect } = require("@playwright/test");
const { _electron } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");

test("pet remains fully visible and returns to bottom right at 70%, 100%, 150% and on a small work area", async () => {
  const scratch = path.resolve(root, "../../work/size-" + crypto.randomUUID());
  const userData = path.join(scratch, "userdata");
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(
    path.join(userData, "settings.json"),
    JSON.stringify({
      ...require("../src/core.cjs").DEFAULTS,
      shortcut: "Ctrl+Alt+F9",
      autoActions: false,
      alwaysOnTop: false,
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
  const pageErrors = [];
  try {
    const pet = await app.firstWindow();
    pet.on("pageerror", (error) => pageErrors.push(error.message));
    await pet.waitForLoadState();
    const next = app.waitForEvent("window");
    await pet.evaluate(() => window.migrate.openPanel("settings"));
    const panel = await next;
    await panel.waitForLoadState();
    await expect(panel.locator(".version")).toContainText(
      "v" + require("../package.json").version,
    );

    async function nativePlacement() {
      return app.evaluate(({ BrowserWindow, screen }) => {
        const win = BrowserWindow.getAllWindows().find((item) =>
          item.webContents.getURL().endsWith("/pet.html"),
        );
        const b = win.getBounds(),
          area = screen.getPrimaryDisplay().workArea;
        return {
          bounds: b,
          area,
          homeX: Math.max(area.x, area.x + area.width - b.width - 12),
          homeY: Math.max(area.y, area.y + area.height - b.height - 8),
        };
      });
    }
    async function checkLayout(size) {
      await expect.poll(() => pet.evaluate(() => settings?.size)).toBe(size);
      await expect
        .poll(async () => {
          const n = await nativePlacement();
          const viewport = await pet.evaluate(() => ({
            width: innerWidth,
            height: innerHeight,
          }));
          const width = Math.min(
            Math.round(320 * size),
            Math.max(1, n.area.width - 12),
          );
          const height = Math.min(
            Math.round(420 * size),
            Math.max(1, n.area.height - 8),
          );
          return (
            Math.abs(viewport.width - width) +
            Math.abs(viewport.height - height)
          );
        })
        .toBeLessThanOrEqual(4);
      await expect
        .poll(async () => {
          const n = await nativePlacement();
          return (
            Math.abs(n.bounds.x - n.homeX) + Math.abs(n.bounds.y - n.homeY)
          );
          // Windows can round each native edge by a physical pixel at fractional DPI.
        })
        .toBeLessThanOrEqual(4);
      // Native resizing and renderer layout are asynchronous; wait for the actual fit.
      await expect
        .poll(() =>
          pet.evaluate(() => {
            const r = document.querySelector("#stage").getBoundingClientRect();
            const fit = Math.min(
              settings.size,
              innerWidth / 320,
              innerHeight / 420,
            );
            return (
              Math.abs(r.width - 320 * fit) + Math.abs(r.height - 420 * fit)
            );
          }),
        )
        .toBeLessThan(1);
      const rects = await pet.evaluate(() => {
        const rect = (element) => {
          const r = element.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        };
        return {
          viewport: { width: innerWidth, height: innerHeight },
          stage: rect(document.querySelector("#stage")),
          dock: rect(document.querySelector(".dock")),
        };
      });
      console.log("Size geometry:", JSON.stringify({ size, ...rects }));
      for (const r of [rects.stage, rects.dock]) {
        expect(r.x).toBeGreaterThanOrEqual(-1);
        expect(r.y).toBeGreaterThanOrEqual(-1);
        expect(r.right).toBeLessThanOrEqual(rects.viewport.width + 1);
        expect(r.bottom).toBeLessThanOrEqual(rects.viewport.height + 1);
      }
      expect(rects.stage.right).toBeCloseTo(rects.viewport.width, 0);
      expect(rects.stage.bottom).toBeCloseTo(rects.viewport.height, 0);
      return rects;
    }
    for (const size of [1, 1.5, 0.7, 1.5, 1]) {
      const result = await panel.evaluate(
        (value) => window.migrate.saveSettings({ size: value }),
        size,
      );
      expect(result.ok, result.error).toBe(true);
      // Move away from the corner before invoking the user's "go home" action.
      await app.evaluate(({ BrowserWindow, screen }) => {
        const win = BrowserWindow.getAllWindows().find((item) =>
          item.webContents.getURL().endsWith("/pet.html"),
        );
        const area = screen.getPrimaryDisplay().workArea;
        win.setPosition(area.x + 10, area.y + 10);
      });
      await pet.evaluate(() => window.migrate.home());
      await checkLayout(size);
      if (size === 1.5)
        await pet.screenshot({
          path: path.join(scratch, "size-150.png"),
          omitBackground: true,
        });
    }
    await app.evaluate(({ screen }) => {
      const original = screen.getPrimaryDisplay();
      screen.getPrimaryDisplay = () => ({
        ...original,
        workArea: {
          ...original.workArea,
          width: Math.min(600, original.workArea.width),
          height: Math.min(360, original.workArea.height),
        },
      });
    });
    expect(
      (await panel.evaluate(() => window.migrate.saveSettings({ size: 1.5 })))
        .ok,
    ).toBe(true);
    await pet.evaluate(() => window.migrate.home());
    const small = await checkLayout(1.5);
    expect(small.stage.height).toBeLessThanOrEqual(360);
    await pet.screenshot({
      path: path.join(scratch, "small-work-area.png"),
      omitBackground: true,
    });
    expect(pageErrors).toEqual([]);
    fs.writeFileSync(
      path.resolve(root, "../../work/latest-size-test.json"),
      JSON.stringify(
        {
          scratch,
          sizes: [0.7, 1, 1.5],
          smallViewport: small.viewport,
          errors: pageErrors,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
});
