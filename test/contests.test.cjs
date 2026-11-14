"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const {
  parseCodeforces,
  parseAtCoder,
  dueContests,
  ContestService,
  contestUrl,
} = require("../src/contests.cjs");
const start = Date.parse("2026-11-15T12:00:00+09:00");
const cf = (stamp = start) => ({
  status: "OK",
  result: [
    {
      id: 99999,
      name: "Test Codeforces Round",
      phase: "BEFORE",
      startTimeSeconds: stamp / 1000,
      durationSeconds: 7200,
    },
    {
      id: 99998,
      name: "Ended",
      phase: "FINISHED",
      startTimeSeconds: stamp / 1000,
      durationSeconds: 7200,
    },
  ],
});
const ac = `<div id="contest-table-upcoming"><table><tbody><tr><td><time>2026-11-15 12:00:00+0900</time></td><td><a href="/contests/abc-test">Test AtCoder Contest</a></td><td>01:40</td></tr><tr><td><time>2026-11-15 12:00:00+0900</time></td><td><a href="https://evil.test/">Ignore</a></td><td>01:40</td></tr></tbody></table></div><div id="contest-table-daily"><table><tbody><tr><td><time>2026-11-15 12:00:00+0900</time></td><td><a href="/contests/abc-test">Duplicate</a></td><td>01:40</td></tr></tbody></table></div>`;
test("official feed parsers normalize JST, duration, canonical URLs, deduplicate and reject changed responses", () => {
  const c = parseCodeforces(cf()),
    a = parseAtCoder(ac);
  assert.equal(c.length, 1);
  assert.equal(a.length, 1);
  assert.equal(c[0].startsAt, start);
  assert.equal(a[0].startsAt, start);
  assert.equal(a[0].durationSeconds, 6000);
  assert.equal(a[0].url, "https://atcoder.jp/contests/abc-test");
  assert.throws(() => parseCodeforces({ status: "FAILED" }));
  assert.throws(() => parseAtCoder("<html>blocked</html>"));
  assert.throws(() => contestUrl("atcoder", "../../evil"));
  assert.throws(() => contestUrl("codeforces", "123?token=x"));
});
test("five-minute window includes the boundary, skips started events and never repeats", () => {
  const c = parseCodeforces(cf());
  assert.equal(dueContests(c, start - 300001, new Set()).length, 0);
  assert.equal(dueContests(c, start - 300000, new Set()).length, 1);
  assert.equal(dueContests(c, start - 1, new Set()).length, 1);
  assert.equal(dueContests(c, start, new Set()).length, 0);
  assert.equal(dueContests(c, start - 100000, new Set([c[0].key])).length, 0);
});
test("service fetches no credentials, persists reminder receipts across restart and respects each toggle", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migrate-contests-")),
    cacheFile = path.join(dir, "contest-cache.json");
  let now = start - 400000,
    settings = {
      contestReminders: true,
      codeforcesReminders: true,
      atcoderReminders: true,
    };
  const notices = [],
    requests = [];
  const args = {
    cacheFile,
    getSettings: () => settings,
    now: () => now,
    onReminder: (items) => notices.push(items),
    fetcher: async (url, options) => {
      requests.push({ url, options });
      return url.includes("codeforces")
        ? Response.json(cf())
        : new Response(ac);
    },
  };
  try {
    const service = new ContestService(args);
    await service.refresh();
    assert.equal(service.snapshot().items.length, 2);
    assert.equal(notices.length, 0);
    for (const { options } of requests) {
      assert.equal(options.credentials, "omit");
      assert.equal(options.redirect, "error");
      assert.deepEqual(Object.keys(options.headers), ["Accept"]);
    }
    now = start - 300000;
    service.tick();
    service.tick();
    assert.equal(notices.length, 1);
    assert.equal(notices[0].length, 2);
    const restarted = new ContestService(args);
    restarted.tick();
    assert.equal(notices.length, 1);
    const nextStart = start + 3600000;
    args.fetcher = async (url) =>
      url.includes("codeforces")
        ? Response.json(cf(nextStart))
        : new Response(ac);
    const moved = new ContestService(args);
    await moved.refresh();
    settings.codeforcesReminders = false;
    now = nextStart - 300000;
    moved.tick();
    assert.equal(notices.length, 1);
    settings.codeforcesReminders = true;
    moved.tick();
    assert.equal(notices.length, 2);
    settings.contestReminders = false;
    assert.equal(
      moved.snapshot().providers.some((p) => p.enabled),
      false,
    );
    const count = requests.length;
    await moved.refresh();
    assert.equal(requests.length, count);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("network failures retain fresh cached schedules and expose errors, stale cache never triggers", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migrate-outage-"));
  let now = start - 400000;
  const calls = [];
  const settings = {
    contestReminders: true,
    codeforcesReminders: true,
    atcoderReminders: false,
  };
  try {
    const service = new ContestService({
      cacheFile: path.join(dir, "cache.json"),
      getSettings: () => settings,
      now: () => now,
      onReminder: (items) => calls.push(items),
      fetcher: async () => Response.json(cf()),
    });
    await service.refresh();
    service.fetcher = async () => {
      throw new Error("offline");
    };
    await service.refresh();
    assert.equal(service.snapshot().items.length, 1);
    assert.match(service.snapshot().providers[0].error, /获取失败/);
    now = start - 300000;
    service.tick();
    assert.equal(calls.length, 1);
    service.notified.clear();
    service.providers.codeforces.fetchedAt = now - 86400001;
    service.tick();
    assert.equal(calls.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
