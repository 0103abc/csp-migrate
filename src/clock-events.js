(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MigrateClockEvents = factory();
})(globalThis, function () {
  const dayKey = (date) =>
    `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  function period(date) {
    const h = date.getHours();
    return h < 5
      ? "midnight"
      : h < 7
        ? "dawn"
        : h < 11
          ? "morning"
          : h < 14
            ? "noon"
            : h < 17
              ? "afternoon"
              : h < 19
                ? "sunset"
                : h < 22
                  ? "evening"
                  : "bedtime";
  }
  function createState(date = new Date()) {
    return {
      day: dayKey(date),
      seen: new Set([`period:${period(date)}`]),
      lastCue: date.getTime(),
      lastBreak: date.getTime(),
      breakCount: 0,
    };
  }
  function takeDue(date, state, options = {}) {
    const now = date.getTime();
    if (!options.timeAware) return null;
    if (state.day !== dayKey(date)) {
      state.day = dayKey(date);
      state.seen.clear();
    }
    if (now < state.lastCue) {
      state.lastCue = now;
      state.lastBreak = now;
      return null;
    }
    if (now - state.lastCue < 600000) return null;
    const minute = date.getHours() * 60 + date.getMinutes();
    const candidates = [];
    for (const [group, start, end] of [
      ["breakfast", 450, 570],
      ["lunch", 690, 810],
      ["dinner", 1050, 1170],
    ])
      if (minute >= start && minute < end)
        candidates.push({ key: `meal:${group}`, group });
    candidates.push({ key: `period:${period(date)}`, group: period(date) });
    if (options.restReminders && now - state.lastBreak >= 1800000)
      candidates.push({
        key: `break:${state.breakCount}`,
        group: state.breakCount % 2 ? "stretchBreak" : "water",
        rest: true,
      });
    if (options.hourlyChime && date.getMinutes() < 2)
      candidates.push({ key: `hour:${date.getHours()}`, group: "hourly" });
    const event = candidates.find((item) => !state.seen.has(item.key));
    if (!event) return null;
    state.seen.add(event.key);
    state.lastCue = now;
    if (event.rest) {
      state.lastBreak = now;
      state.breakCount++;
    }
    return {
      group: event.group,
      time: new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date),
    };
  }
  return { dayKey, period, createState, takeDue };
});
