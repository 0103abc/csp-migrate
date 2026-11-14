"use strict";
// Inspect only tracked source; never enumerate the user's credential stores.
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const files = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const forbidden =
  /(^|\/)(?:\.env(?:\..+)?|settings\.json(?:\.tmp)?|userdata|node_modules|dist)(?:\/|$)|\.(?:pem|key)$/i;
const patterns = [
  /sk-[a-zA-Z0-9_-]{20,}/,
  /gh[pousr]_[a-zA-Z0-9]{20,}/,
  /github_pat_[a-zA-Z0-9_]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const bad = [];
for (const file of files) {
  if (forbidden.test(file)) {
    bad.push(file + ": local configuration or private file");
    continue;
  }
  if (!/\.(?:cjs|js|json|md|txt|ya?ml|html|css|ps1)$/.test(file)) continue;
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (patterns.some((pattern) => pattern.test(text)))
    bad.push(file + ": possible credential");
}
// Also inspect committed history, so deleting a secret later does not hide an earlier leak.
const head = spawnSync("git", ["rev-parse", "--verify", "HEAD"], {
  cwd: root,
  stdio: "ignore",
});
if (head.error) throw head.error;
if (head.status === 0) {
  const history = execFileSync(
    "git",
    ["log", "--all", "-p", "--format=", "--", ".", ":!package-lock.json"],
    { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (patterns.some((pattern) => pattern.test(history)))
    bad.push("git history: possible credential");
} else if (head.status !== 128)
  throw new Error("Unable to inspect Git history.");
if (bad.length) {
  console.error(bad.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Checked ${files.length} tracked files: no key patterns or local configuration files found.`,
  );
