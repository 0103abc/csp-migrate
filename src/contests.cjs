"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const cheerio = require("cheerio");
const SOURCES = {
  codeforces: "https://codeforces.com/api/contest.list?gym=false",
  atcoder: "https://atcoder.jp/contests/?lang=en",
};
function contestUrl(provider, id) {
  if (provider === "codeforces" && /^\d+$/.test(String(id)))
    return `https://codeforces.com/contest/${id}`;
  if (provider === "atcoder" && /^[a-z0-9_-]+$/i.test(String(id)))
    return `https://atcoder.jp/contests/${id}`;
  throw new Error("Invalid contest identifier.");
}
function normalize(provider, item) {
  if (
    !item ||
    !Number.isFinite(item.startsAt) ||
    !Number.isFinite(item.durationSeconds) ||
    item.durationSeconds < 0 ||
    typeof item.name !== "string"
  )
    throw new Error("Invalid contest data.");
  const id = String(item.id),
    url = contestUrl(provider, id);
  return {
    provider,
    id,
    key: `${provider}:${id}:${item.startsAt}`,
    name: item.name.replace(/\s+/g, " ").trim().slice(0, 240),
    startsAt: item.startsAt,
    durationSeconds: item.durationSeconds,
    url,
  };
}
function parseCodeforces(value) {
  if (value?.status !== "OK" || !Array.isArray(value.result))
    throw new Error("Codeforces 未返回有效赛程。");
  return value.result
    .filter(
      (item) =>
        item.phase === "BEFORE" && Number.isFinite(item.startTimeSeconds),
    )
    .map((item) =>
      normalize("codeforces", {
        id: item.id,
        name: item.name,
        startsAt: item.startTimeSeconds * 1000,
        durationSeconds: item.durationSeconds,
      }),
    );
}
function parseAtCoder(html) {
  const $ = cheerio.load(html),
    results = [];
  const tables = $("#contest-table-upcoming, #contest-table-daily");
  if (!tables.length) throw new Error("AtCoder 赛程页面结构发生变化。");
  tables.find("tbody tr").each((_, row) => {
    const cells = $(row).find("td"),
      link = cells.eq(1).find('a[href^="/contests/"]').first();
    const id = link.attr("href")?.match(/^\/contests\/([a-z0-9_-]+)\/?$/i)?.[1];
    const stamp =
      cells.eq(0).find("time").text().trim() || cells.eq(0).text().trim();
    const iso = stamp.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2"),
      startsAt = Date.parse(iso);
    const duration = cells
      .eq(2)
      .text()
      .trim()
      .match(/^(\d+):(\d{2})$/);
    if (!id || !Number.isFinite(startsAt) || !duration) return;
    results.push(
      normalize("atcoder", {
        id,
        name: link.text(),
        startsAt,
        durationSeconds: (Number(duration[1]) * 60 + Number(duration[2])) * 60,
      }),
    );
  });
  return [...new Map(results.map((item) => [item.key, item])).values()];
}
function dueContests(contests, now, notified) {
  return contests.filter(
    (item) =>
      now >= item.startsAt - 300000 &&
      now < item.startsAt &&
      !notified.has(item.key),
  );
}
class ContestService {
  constructor({
    cacheFile,
    getSettings,
    onChange = () => {},
    onReminder = () => {},
    fetcher = fetch,
    now = Date.now,
  }) {
    Object.assign(this, {
      cacheFile,
      getSettings,
      onChange,
      onReminder,
      fetcher,
      now,
    });
    this.providers = {};
    this.notified = new Set();
    this.pending = null;
    this.timers = [];
    try {
      const value = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      for (const provider of Object.keys(SOURCES)) {
        const data = value.providers?.[provider];
        if (data && Number.isFinite(data.fetchedAt))
          this.providers[provider] = {
            fetchedAt: data.fetchedAt,
            error: "",
            items: (data.items || []).map((item) => normalize(provider, item)),
          };
      }
      for (const key of value.notified || [])
        if (typeof key === "string") this.notified.add(key);
    } catch {}
  }
  enabled(provider) {
    const s = this.getSettings();
    return (
      s.contestReminders &&
      (provider === "codeforces" ? s.codeforcesReminders : s.atcoderReminders)
    );
  }
  snapshot() {
    const now = this.now();
    return {
      items: Object.values(this.providers)
        .flatMap((p) => p.items || [])
        .filter((item) => item.startsAt > now)
        .sort((a, b) => a.startsAt - b.startsAt)
        .slice(0, 40),
      providers: Object.keys(SOURCES).map((provider) => ({
        provider,
        enabled: this.enabled(provider),
        fetchedAt: this.providers[provider]?.fetchedAt || null,
        error: this.providers[provider]?.error || "",
      })),
      reminderMinutes: 5,
      refreshing: !!this.pending,
    };
  }
  persist() {
    if (!this.cacheFile) return;
    try {
      fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
      const recent = new Set(
        Object.values(this.providers)
          .flatMap((p) => p.items || [])
          .filter((item) => item.startsAt > this.now() - 86400000)
          .map((item) => item.key),
      );
      this.notified = new Set(
        [...this.notified].filter((key) => recent.has(key)),
      );
      fs.writeFileSync(
        this.cacheFile + ".tmp",
        JSON.stringify({
          providers: this.providers,
          notified: [...this.notified],
        }),
      );
      fs.renameSync(this.cacheFile + ".tmp", this.cacheFile);
    } catch {}
  }
  async refresh() {
    if (this.pending) return this.pending;
    this.pending = (async () => {
      await Promise.all(
        Object.entries(SOURCES).map(async ([provider, url]) => {
          if (!this.enabled(provider)) return;
          try {
            const response = await this.fetcher(url, {
              method: "GET",
              credentials: "omit",
              redirect: "error",
              signal: AbortSignal.timeout(20000),
              headers: {
                Accept:
                  provider === "codeforces" ? "application/json" : "text/html",
              },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const items =
              provider === "codeforces"
                ? parseCodeforces(await response.json())
                : parseAtCoder(await response.text());
            this.providers[provider] = {
              items,
              fetchedAt: this.now(),
              error: "",
            };
          } catch {
            this.providers[provider] = {
              ...(this.providers[provider] || { items: [], fetchedAt: 0 }),
              error: "获取失败，稍后自动重试。",
            };
          }
        }),
      );
      this.persist();
      this.tick();
    })();
    this.onChange(this.snapshot());
    try {
      await this.pending;
    } finally {
      this.pending = null;
      this.onChange(this.snapshot());
    }
    return this.snapshot();
  }
  tick() {
    clearTimeout(this.nextTimer);
    const now = this.now();
    const items = Object.entries(this.providers)
      .filter(
        ([provider, data]) =>
          this.enabled(provider) && now - data.fetchedAt < 86400000,
      )
      .flatMap(([, data]) => data.items || []);
    const due = dueContests(items, now, this.notified);
    if (due.length) {
      due.forEach((item) => this.notified.add(item.key));
      this.persist();
      this.onReminder(due);
    }
    const next = items
      .filter(
        (item) => item.startsAt - 300000 > now && !this.notified.has(item.key),
      )
      .sort((a, b) => a.startsAt - b.startsAt)[0];
    if (next) {
      this.nextTimer = setTimeout(
        () => this.tick(),
        Math.min(2147483647, next.startsAt - 300000 - now),
      );
      this.nextTimer.unref?.();
    }
  }
  start() {
    this.stop();
    void this.refresh();
    this.timers = [
      setInterval(() => this.tick(), 15000),
      setInterval(() => {
        if (this.getSettings().contestReminders) void this.refresh();
      }, 600000),
    ];
    this.timers.forEach((timer) => timer.unref?.());
  }
  stop() {
    clearTimeout(this.nextTimer);
    this.timers.forEach(clearInterval);
    this.timers = [];
  }
}
module.exports = {
  SOURCES,
  contestUrl,
  normalize,
  parseCodeforces,
  parseAtCoder,
  dueContests,
  ContestService,
};
