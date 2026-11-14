"use strict";
const api = window.migrate,
  pet = document.querySelector("#pet"),
  sprite = document.querySelector("#sprite"),
  bubble = document.querySelector("#bubble");
const turnSprite = document.querySelector("#turn-sprite");
const dialogue = window.MigrateDialogue;
for (const selector of ["#bubble", "#hide"])
  document.querySelector(selector).setAttribute("data-no-localize", "");
const applyLocale = window.MigrateI18n.bindDocument(document);
const sprites = {
  idle: "idle",
  wave: "wave",
  back: "back",
  magic: "magic",
  happy: "happy",
  sleep: "sleep",
  walk: "side",
  talk: "talk",
  nod: "idle",
  shake: "idle",
  bounce: "happy",
  float: "magic",
  birds: "magic",
  stretch: "wave",
  shy: "talk",
  sway: "idle",
  looksea: "back",
  peek: "side",
};
const images = Object.values(sprites).map((name) => {
  const img = new Image();
  img.src = `../assets/${name}.png`;
  return img;
});
let settings = null,
  actionTimer,
  bubbleTimer,
  dragStart = null,
  wasDragged = false,
  lastActivity = Date.now(),
  back = false,
  active = "idle",
  talkTimer,
  turnGeneration = 0,
  turnAnimations = [],
  turning = false,
  poseTimers = [];
const choreography = {
  wave: {
    duration: 6100,
    poses: [
      [300, "wave"],
      [2200, "talk"],
      [3000, "wave"],
      [4900, "idle"],
    ],
  },
  happy: {
    duration: 5000,
    poses: [
      [300, "happy"],
      [2300, "wave"],
      [3900, "idle"],
    ],
  },
  magic: {
    duration: 8000,
    poses: [
      [400, "sleep"],
      [1600, "magic"],
      [5900, "talk"],
      [6900, "idle"],
    ],
  },
  birds: {
    duration: 8000,
    poses: [
      [400, "wave"],
      [1700, "magic"],
      [5700, "wave"],
      [6900, "idle"],
    ],
  },
  float: {
    duration: 8500,
    poses: [
      [900, "magic"],
      [5900, "talk"],
      [7300, "idle"],
    ],
  },
  stretch: {
    duration: 6500,
    poses: [
      [900, "wave"],
      [4200, "sleep"],
      [5400, "idle"],
    ],
  },
  shy: {
    duration: 6000,
    poses: [
      [650, "talk"],
      [2100, "sleep"],
      [3900, "talk"],
      [5000, "idle"],
    ],
  },
  looksea: {
    duration: 7300,
    poses: [
      [400, "side"],
      [1100, "back"],
      [5000, "side"],
      [5900, "idle"],
    ],
  },
  peek: {
    duration: 5000,
    poses: [
      [700, "side"],
      [2800, "talk"],
      [4000, "idle"],
    ],
  },
  bounce: {
    duration: 5000,
    poses: [
      [450, "happy"],
      [2600, "wave"],
      [3900, "idle"],
    ],
  },
};
const T = (value) =>
  window.MigrateI18n.text(value, settings?.locale || "zh-CN");
function say(text, duration = 5000) {
  clearTimeout(bubbleTimer);
  bubble.dataset.original = text;
  bubble.textContent = T(text);
  bubble.classList.remove("quiet");
  bubbleTimer = setTimeout(() => bubble.classList.add("quiet"), duration);
}
function frame(name) {
  sprite.src = `../assets/${sprites[name] || name}.png`;
}
function cancelTurn() {
  ++turnGeneration;
  for (const timer of poseTimers) clearTimeout(timer);
  poseTimers = [];
  for (const animation of turnAnimations) animation.cancel();
  turnAnimations = [];
  turnSprite.style.opacity = "0";
  turning = false;
}
async function blendPose(pose, generation, duration = 330) {
  if (generation !== turnGeneration) return;
  const url = `../assets/${sprites[pose] || pose}.png`;
  if (sprite.getAttribute("src") === url) return;
  turnSprite.src = url;
  await turnSprite.decode().catch(() => {});
  if (generation !== turnGeneration) return;
  const options = {
    duration,
    easing: "cubic-bezier(.22,.61,.36,1)",
    fill: "forwards",
  };
  turnAnimations = [
    sprite.animate([{ opacity: 1 }, { opacity: 0 }], options),
    turnSprite.animate([{ opacity: 0 }, { opacity: 1 }], options),
  ];
  await Promise.all(
    turnAnimations.map((animation) => animation.finished.catch(() => {})),
  );
  if (generation !== turnGeneration) return;
  frame(pose);
  await sprite.decode().catch(() => {});
  for (const animation of turnAnimations) animation.cancel();
  turnAnimations = [];
  turnSprite.style.opacity = "0";
}
async function smoothTurn() {
  turning = true;
  back = !back;
  const generation = ++turnGeneration,
    direction = back ? 1 : -1;
  pet.classList.add("turning");
  say(back ? "让我看看，风是从哪儿来的……" : "我回来啦。你在这里，真好。");
  const poses = back ? ["side", "back"] : ["side", "idle"];
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    frame(poses.at(-1));
    turning = false;
    pet.classList.remove("turning");
    return;
  }
  for (const pose of poses) {
    if (generation !== turnGeneration) return;
    turnSprite.src = `../assets/${sprites[pose] || pose}.png`;
    await turnSprite.decode().catch(() => {});
    if (generation !== turnGeneration) return;
    const options = {
      duration: 360,
      easing: "cubic-bezier(.25,.1,.25,1)",
      fill: "forwards",
    };
    turnAnimations = [
      sprite.animate(
        [
          { opacity: 1, transform: "translateX(0) rotateY(0deg)" },
          {
            opacity: 0,
            transform: `translateX(${direction * 5}px) rotateY(${direction * 25}deg)`,
          },
        ],
        options,
      ),
      turnSprite.animate(
        [
          {
            opacity: 0,
            transform: `translateX(${-direction * 5}px) rotateY(${-direction * 25}deg)`,
          },
          { opacity: 1, transform: "translateX(0) rotateY(0deg)" },
        ],
        options,
      ),
    ];
    await Promise.all(
      turnAnimations.map((animation) => animation.finished.catch(() => {})),
    );
    if (generation !== turnGeneration) return;
    frame(pose);
    await sprite.decode().catch(() => {});
    for (const animation of turnAnimations) animation.cancel();
    turnAnimations = [];
    turnSprite.style.opacity = "0";
  }
  if (generation === turnGeneration) {
    turning = false;
    pet.classList.remove("turning");
  }
}
const actionGroups = {
  wave: "wave",
  magic: "magic",
  happy: "happy",
  sleep: "sleep",
  nod: "nod",
  shake: "shake",
  bounce: "bounce",
  float: "float",
  birds: "birds",
  stretch: "stretch",
  shy: "shy",
  sway: "sway",
  looksea: "sea",
  peek: "idle",
};
function perform(value, group) {
  if (value && typeof value === "object") {
    group = Object.hasOwn(dialogue.groups, value.group) ? value.group : "idle";
    value = dialogue.groups[group].action;
  }
  if (value === "turn" && turning) return;
  cancelTurn();
  clearTimeout(actionTimer);
  clearInterval(talkTimer);
  lastActivity = Date.now();
  pet.className = "pet";
  active = value;
  if (value === "turn") {
    smoothTurn();
    return;
  }
  back = false;
  if (value.startsWith("walk-") || value.startsWith("drag-")) {
    frame("walk");
    pet.classList.add(value.startsWith("walk") ? "walk" : "drag");
    if (value.endsWith("left")) pet.classList.add("facing-left");
    if (value.startsWith("walk")) say(dialogue.sample("sea"));
    else say(dialogue.sample("drag"));
    return;
  }
  if (value === "drop") {
    frame("happy");
    pet.classList.add("drop");
    say(dialogue.sample("drop"));
  } else if (value === "thinking") {
    frame("idle");
    pet.classList.add("thinking");
    say("听到了，容我想一想……", 120000);
    return;
  } else {
    frame(choreography[value] ? "idle" : sprites[value] ? value : "idle");
    pet.classList.add(value);
    if (group || actionGroups[value])
      say(
        dialogue.sample(group || actionGroups[value]),
        value === "sleep" ? 8000 : 6500,
      );
    if (value === "talk") say("海风捎来了回信。");
    document.querySelector("#sparkles").textContent =
      value === "shy" ? "♡" : value === "sleep" ? "z" : "✧";
  }
  if (choreography[value]) {
    const generation = turnGeneration;
    poseTimers = choreography[value].poses.map(([at, pose]) =>
      setTimeout(() => blendPose(pose, generation), at),
    );
  }
  if (value === "talk") {
    let open = true;
    talkTimer = setInterval(() => {
      frame(open ? "idle" : "talk");
      open = !open;
    }, 260);
  }
  if (value !== "idle")
    actionTimer = setTimeout(
      () => perform("idle"),
      choreography[value]?.duration ||
        (value === "sleep"
          ? 14000
          : value === "talk"
            ? 2200
            : value === "drop"
              ? 1400
              : 5000),
    );
}
function update(value) {
  settings = value;
  applyLocale(value.locale);
  if (bubble.dataset.original) bubble.textContent = T(bubble.dataset.original);
  document.querySelector("#stage").style.transform = `scale(${value.size})`;
  document.querySelector("#stage").style.width = "320px";
  document.querySelector("#stage").style.height = "420px";
  document.querySelector("#hide").title = T(`隐藏（${value.shortcut} 呼出）`);
}
api.getSettings().then(update);
api.onSettings(update);
api.onAction(perform);
document.querySelector("#chat").onclick = () => api.openPanel("chat");
document.querySelector("#settings").onclick = () => api.openPanel("settings");
document.querySelector("#hide").onclick = () => api.hide();
document.querySelector("#turn").onclick = () => api.action("turn");
document.querySelector("#magic").onclick = () => api.action("magic");
document.querySelector("#music").onclick = () => api.openPanel("music");
document.querySelector("#problem").onclick = () => api.openProblem();
document.addEventListener("pointermove", (event) => {
  api.ignoreMouse(!event.target.closest("[data-interactive]"));
  if (
    dragStart &&
    Math.abs(event.screenX - dragStart.x) +
      Math.abs(event.screenY - dragStart.y) >
      5
  )
    wasDragged = true;
});
document.addEventListener("pointerleave", () => {
  if (!dragStart) api.ignoreMouse(true);
});
pet.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  wasDragged = false;
  dragStart = { x: event.screenX, y: event.screenY };
  pet.setPointerCapture(event.pointerId);
  api.dragStart();
});
function endDrag() {
  if (dragStart) {
    api.dragEnd();
    dragStart = null;
  }
}
pet.addEventListener("pointerup", endDrag);
pet.addEventListener("lostpointercapture", endDrag);
window.addEventListener("blur", endDrag);
pet.addEventListener("click", () => {
  if (!wasDragged) api.action("wave");
});
pet.addEventListener("dblclick", () => {
  if (!wasDragged) api.openPanel("chat");
});
document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  api.menu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") api.hide();
});
setInterval(() => {
  if (
    settings?.autoActions &&
    !document.hidden &&
    !dragStart &&
    active === "idle" &&
    Date.now() - lastActivity > (settings.idleInterval || 90) * 1000
  ) {
    perform({ group: dialogue.ambientGroup() });
  }
}, 7000);
say(dialogue.sample(dialogue.timeGroup()), 9000);
