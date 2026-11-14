const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./test",
  testMatch: "electron.spec.cjs",
  timeout: 120000,
  workers: 1,
  reporter: "list",
  use: { trace: "retain-on-failure" },
});
