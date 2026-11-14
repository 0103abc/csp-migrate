"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { sampleFrames } = require("../src/turn-player.js"),
  clock = require("../src/clock-events.js"),
  dialogue = require("../src/dialogue.js");
const date = (hour, minute = 0, day = 14) =>
  new Date(2026, 10, day, hour, minute);
test("turn interpolation covers 16 ordered angles both ways and slows at endpoints", () => {
  assert.equal(sampleFrames(0).lower, 0);
  assert.equal(sampleFrames(1).lower, 15);
  assert.equal(sampleFrames(0, true).lower, 15);
  assert.equal(sampleFrames(1, true).lower, 0);
  const forward = Array.from({ length: 101 }, (_, i) => sampleFrames(i / 100));
  assert.equal(new Set(forward.map((f) => f.lower)).size, 16);
  forward.forEach((f, i) => {
    assert.ok(f.blend >= 0 && f.blend < 1);
    if (i) assert.ok(f.lower >= forward[i - 1].lower);
  });
  assert.ok(sampleFrames(0.01).blend < sampleFrames(0.51).blend);
});
test("local-time dialogue periods cover dawn, lunch, afternoon, sunset and midnight", () => {
  for (const [hour, group] of [
    [3, "midnight"],
    [5, "dawn"],
    [9, "morning"],
    [12, "noon"],
    [15, "afternoon"],
    [18, "sunset"],
    [20, "evening"],
    [23, "bedtime"],
  ]) {
    assert.equal(dialogue.timeGroup(date(hour)), group);
    assert.equal(clock.period(date(hour)), group);
    assert.ok(dialogue.groups[group].lines.length >= 10);
  }
  const disabled = Array.from({ length: 100 }, () =>
    dialogue.ambientGroup(date(3), Math.random, false),
  );
  assert.ok(
    disabled.every(
      (id) => !["night", "midnight", "sleep", "weekend", "dawn"].includes(id),
    ),
  );
});
test("meal reminders deduplicate, honor quiet cooldown and reset on a new local day", () => {
  const s = clock.createState(date(11, 20)),
    o = { timeAware: true };
  assert.equal(clock.takeDue(date(11, 29), s, o), null);
  assert.equal(clock.takeDue(date(11, 30), s, o).group, "lunch");
  assert.equal(clock.takeDue(date(11, 40), s, o), null);
  assert.equal(clock.takeDue(date(12), s, o), null);
  const resumed = clock.resumeState(s, date(12, 10));
  assert.equal(clock.takeDue(date(12, 20), resumed, o), null);
  const tomorrow = clock.resumeState(resumed, date(11, 20, 15));
  assert.equal(clock.takeDue(date(11, 30, 15), tomorrow, o).group, "lunch");
  assert.equal(clock.takeDue(date(14), s, o).group, "afternoon");
  assert.equal(clock.takeDue(date(14, 1), s, o), null);
  assert.equal(clock.takeDue(date(14, 20), s, { timeAware: false }), null);
  assert.equal(clock.takeDue(date(11, 30, 15), s, o).group, "lunch");
});
test("rest and optional hourly cues stay spaced and recover from clock changes", () => {
  const s = clock.createState(date(14)),
    o = { timeAware: true, restReminders: true, hourlyChime: true };
  assert.equal(clock.takeDue(date(14, 30), s, o).group, "water");
  assert.equal(clock.takeDue(date(14, 31), s, o), null);
  assert.equal(clock.takeDue(date(15), s, o).group, "stretchBreak");
  assert.equal(
    clock.takeDue(date(16), s, { timeAware: true, hourlyChime: true }).group,
    "hourly",
  );
  assert.equal(clock.takeDue(date(14), s, o), null);
  assert.equal(clock.takeDue(date(14, 1), s, o), null);
});
