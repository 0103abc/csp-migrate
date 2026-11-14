"use strict";
const { packager } = require("@electron/packager");
const path = require("node:path");
(async () => {
  const paths = await packager({
    dir: path.resolve(__dirname, ".."),
    out: process.env.MIGRATE_BUILD_OUT
      ? path.resolve(process.env.MIGRATE_BUILD_OUT)
      : path.resolve(__dirname, "../dist"),
    name: "Migrate",
    platform: "win32",
    arch: "x64",
    overwrite: true,
    asar: true,
    prune: true,
    ...(process.env.ELECTRON_ZIP_DIR
      ? { electronZipDir: path.resolve(process.env.ELECTRON_ZIP_DIR) }
      : {}),
    icon: path.resolve(__dirname, "../assets/icon.ico"),
    executableName: "Migrate",
    appBundleId: "com.csp.migrate",
    appCopyright: "csp-migrate contributors",
    win32metadata: {
      CompanyName: "csp-migrate",
      FileDescription: "Migrate Desktop Companion",
      ProductName: "Migrate",
    },
    ignore: [
      /^\/dist(?:\/|$)/,
      /^\/\.githooks(?:\/|$)/,
      /^\/\.git(?:\/|$)/,
      /^\/\.github(?:\/|$)/,
      /^\/test(?:\/|$)/,
      /^\/test-results(?:\/|$)/,
      /^\/playwright-report(?:\/|$)/,
      /^\/scripts(?:\/|$)/,
      /^\/docs(?:\/|$)/,
      /^\/playwright\.config\.cjs$/,
      /^\/assets\/migrate-atlas\.png$/,
      /^\/assets\/turn-atlas\.png$/,
      /^\/assets\/(?:scenes-atlas|home-backgrounds-atlas)\.png$/,
    ],
  });
  console.log(`Built Windows app: ${paths.join(", ")}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
