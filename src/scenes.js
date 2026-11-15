(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MigrateSceneTheater = factory();
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const step = (at, pose, caption, extra = {}) => ({
    at,
    pose,
    caption,
    ...extra,
  });
  const SCENES = {
    home: {
      title: "去她的灯塔小屋",
      duration: 32000,
      steps: [
        step(0, "invite", "想去我家看看吗？跟上我，海边这条路可漂亮啦！", {
          bg: "coast",
          phase: "welcome",
          food: null,
          shoes: "on",
        }),
        step(2800, "follow", "沿着白色栅栏往前走，别被小海鸟带错路了。", {
          phase: "walking",
        }),
        step(6600, "follow", "看见蓝色屋顶了吗？灯塔旁边那间，就是我的小屋！"),
        step(10200, "invite", "到啦！我来开门——欢迎今天的小客人。", {
          phase: "welcome",
        }),
        step(12200, "remove-shoe", "等一下下，先在门外把鞋脱好——嘿咻，一只！", {
          phase: "removing-shoes",
          shoes: "removing",
        }),
        step(
          15200,
          "place-shoes",
          "另一只也脱下来，整整齐齐放在门外。好啦，不把沙子带进屋！",
          { phase: "placing-shoes", shoes: "outside" },
        ),
        step(18200, "home-welcome", "请进！鞋子留在外面，窗边的位置留给你～", {
          bg: "home",
          phase: "entering",
          shoes: "off",
        }),
        step(
          22200,
          "home-welcome",
          "书架上有航海图和我捡的贝壳。那只歪歪的海螺，是我最喜欢的！",
          { phase: "welcome" },
        ),
        step(
          26200,
          "home-welcome",
          "锵锵，还有一点点待客甜点。想先坐坐，还是一起吃点东西？",
          { phase: "offering", food: "cake" },
        ),
        step(
          29800,
          "home-welcome",
          "这里不用赶路。你就把自己当成来做客的老朋友吧。",
          { phase: "welcome" },
        ),
      ],
    },
    meal: {
      title: "和她一起吃饭",
      duration: 29000,
      steps: [
        step(0, "invite", "饭做好啦！把忙碌先停在门口，来一起吃饭吧。", {
          bg: "home",
          phase: "welcome",
          food: null,
        }),
        step(3000, "eat-rest", "你坐这边，我把热乎乎的饭端上来。小心烫哦。", {
          phase: "dining",
          food: "meal",
        }),
        step(
          6400,
          "eat-rest",
          "今天的搭配很简单：认真吃饭，再留一点肚子装开心。",
        ),
        step(9300, "eat-lift", "我先尝一小口——你也开动吧！"),
        step(11200, "eat-bite", "啊呜……嗯，火候刚刚好。"),
        step(
          14200,
          "eat-happy",
          "好吃！果然，有人一起吃饭，普通的饭也会更香。",
        ),
        step(17500, "eat-rest", "别着急，慢慢吃。今天遇到了什么有趣的事吗？"),
        step(20400, "eat-lift", "我再来一口。你喜欢的菜，下次也可以告诉我。"),
        step(22200, "eat-bite", "唔……吃饭的时候，先不用想那些难题。"),
        step(25100, "eat-happy", "吃饱啦！先坐一会儿，等会儿再一起看海吧。"),
      ],
    },
    cake: {
      title: "请你吃蛋糕",
      duration: 24000,
      steps: [
        step(0, "invite", "先闭一下眼睛——我准备了一个小惊喜！", {
          bg: "home",
          phase: "welcome",
          food: null,
        }),
        step(3000, "offer-cake", "锵锵！草莓蛋糕，今天的第一块请你吃。", {
          phase: "offering",
          food: "cake",
        }),
        step(6200, "offer-cake", "奶油、松软的蛋糕胚，还有最上面那颗小草莓。"),
        step(9400, "offer-cake", "盘子往你这边放一点。最漂亮的一口，留给你！"),
        step(12600, "eat-rest", "我也给自己留了一小份。一起尝尝吧。", {
          phase: "dining",
        }),
        step(15100, "eat-lift", "准备好了？三、二、一——开动！"),
        step(17000, "eat-bite", "唔……甜甜的，像把好心情装进了盘子。"),
        step(20400, "eat-happy", "今天的甜点招待成功！下一次，想试试布丁吗？"),
      ],
    },
    pudding: {
      title: "请你吃布丁",
      duration: 24500,
      steps: [
        step(0, "invite", "这次不是海浪，是一个会晃呀晃的小家伙。", {
          bg: "home",
          phase: "welcome",
          food: null,
        }),
        step(
          3000,
          "offer-pudding",
          "请你吃焦糖布丁！看，它还在盘子上轻轻弹呢。",
          { phase: "offering", food: "pudding" },
        ),
        step(
          6400,
          "offer-pudding",
          "下面是滑滑的布丁，上面是香香的焦糖。勺子也准备好啦。",
        ),
        step(9900, "offer-pudding", "轻轻碰一下——别笑，我只是想再看它晃一下！"),
        step(
          13000,
          "eat-rest",
          "好啦，认真吃甜点时间到。我们一起尝第一口吧。",
          { phase: "dining" },
        ),
        step(15600, "eat-lift", "这一小勺，我要连焦糖一起吃。"),
        step(17500, "eat-bite", "啊呜……嗯！软软的，甜度刚刚好。"),
        step(
          21000,
          "eat-happy",
          "你的那份也要好好享用哦。今天的快乐，再加一小勺！",
        ),
      ],
    },
  };
  const FOODS = {
    meal: '<svg viewBox="0 0 260 100"><ellipse cx="130" cy="72" rx="115" ry="19" fill="#f7f4e9" stroke="#c2d4df" stroke-width="3"/><path d="M82 43Q88 91 153 80L176 43Z" fill="#f2f7fa" stroke="#84a9bf" stroke-width="3"/><ellipse cx="130" cy="44" rx="47" ry="15" fill="#fffaf0"/><path d="M98 41Q112 23 126 37Q140 20 155 41" fill="#fff"/><ellipse cx="199" cy="63" rx="28" ry="12" fill="#e8b968"/><path d="M179 57q14-20 34-3q-14 19-34 3" fill="#729a62"/><path d="M38 72l31-38M44 77l31-38" stroke="#a1724d" stroke-width="5" stroke-linecap="round"/></svg>',
    cake: '<svg viewBox="0 0 260 100"><ellipse cx="130" cy="83" rx="97" ry="13" fill="#fffaf2" stroke="#c4d5df" stroke-width="2"/><g class="dessert"><path d="M70 38L177 30L192 75L70 80Z" fill="#f1c67d"/><path d="M70 53L184 46L188 59L70 66Z" fill="#fff6e7"/><path d="M70 38L158 13L177 30L70 53Z" fill="#fff7ec"/><path d="M70 66L188 59L191 68L70 74Z" fill="#ef8798"/><path d="M124 26C100 6 121-5 130 7C145-8 164 9 139 27Z" fill="#de6271"/><path d="M123 7l8-7l7 8" fill="#679b72"/></g></svg>',
    pudding:
      '<svg viewBox="0 0 260 100"><ellipse cx="130" cy="83" rx="98" ry="14" fill="#fff9ee" stroke="#c4d5df" stroke-width="2"/><ellipse cx="130" cy="78" rx="64" ry="10" fill="#b16b3e" opacity=".55"/><g class="dessert"><path d="M88 29L77 76Q130 96 183 76L172 29Z" fill="#f3cc72" stroke="#d7a953" stroke-width="2"/><ellipse cx="130" cy="30" rx="42" ry="13" fill="#98603b"/><path d="M94 34q15 8 14 29q7 11 12-4l6-17q13 16 18 2q17 18 25-9" fill="#ad7044"/><ellipse cx="130" cy="28" rx="29" ry="7" fill="#be8654"/></g></svg>',
  };
  class ScenePlayer {
    constructor(root, translate = (value) => value) {
      this.root = root;
      this.translate = translate;
      this.frame = null;
      this.generation = 0;
      this.state = null;
      root.innerHTML =
        '<div class="scene-stage"><div class="scene-backgrounds"><img class="scene-bg visible" alt=""><img class="scene-bg" alt=""></div><div class="scene-sunbeam"></div><div class="scene-actor"><img class="scene-character visible" alt="米格瑞特"><img class="scene-character" alt=""></div><div class="scene-table"><div class="scene-food"></div></div><div class="scene-curtain"></div><span class="scene-badge"></span><button class="scene-close" aria-label="结束小场景">×</button></div><div class="scene-caption" role="status"></div><div class="scene-progress" role="progressbar" aria-label="场景进度" aria-valuemin="0" aria-valuemax="100"><i></i></div><div class="scene-controls"><button data-control="pause"></button><button data-control="replay"></button><button data-control="end"></button></div>';
      this.stage = root.querySelector(".scene-stage");
      this.caption = root.querySelector(".scene-caption");
      this.actors = [...root.querySelectorAll(".scene-character")];
      this.backgrounds = [...root.querySelectorAll(".scene-bg")];
      const entry = document.createElement("div");
      entry.className = "scene-entry";
      entry.setAttribute("aria-hidden", "true");
      entry.innerHTML =
        '<span class="entry-opening"></span><span class="entry-frame"></span><span class="entry-mat"></span><img class="entry-boots" src="../assets/scene-door-boots.png" alt="">';
      this.stage.append(entry);
      this.actorLayer = 0;
      this.bgLayer = 0;
      root.querySelector("[data-control=pause]").onclick = () =>
        this.state?.paused ? this.resume() : this.pause();
      root.querySelector("[data-control=replay]").onclick = () => {
        if (this.state) this.play(this.state.id);
      };
      root.querySelector("[data-control=end]").onclick = () => this.stop();
      root.querySelector(".scene-close").onclick = () => this.stop();
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.pause();
      });
      for (const name of [
        "invite",
        "follow",
        "eat-rest",
        "eat-lift",
        "eat-bite",
        "eat-happy",
        "offer-cake",
        "offer-pudding",
        "remove-shoe",
        "place-shoes",
        "home-welcome",
        "door-boots",
      ]) {
        const img = new Image();
        img.src = `../assets/scene-${name}.png`;
      }
      for (const name of ["home", "coast"]) {
        const img = new Image();
        img.src = `../assets/scene-${name}.jpg`;
      }
      this.refreshLocale();
    }
    async swap(layers, name, type) {
      const key = type === "pose" ? "actorLayer" : "bgLayer";
      const current = layers[this[key]],
        nextIndex = 1 - this[key],
        next = layers[nextIndex];
      const src = `../assets/scene-${name}.${type === "pose" ? "png" : "jpg"}`;
      if (current.getAttribute("src") === src) return;
      const generation = this.generation;
      next.src = src;
      try {
        await next.decode();
      } catch {
        return;
      }
      if (generation !== this.generation) return;
      next.classList.add("visible");
      current.classList.remove("visible");
      this[key] = nextIndex;
    }
    applyStep(index) {
      const story = SCENES[this.state.id],
        scene = Object.assign({}, ...story.steps.slice(0, index + 1));
      this.state.index = index;
      this.currentScene = scene;
      this.stage.dataset.phase = scene.phase;
      this.stage.dataset.food = scene.food || "";
      this.stage.dataset.background = scene.bg;
      this.stage.dataset.shoes = scene.shoes || "on";
      this.stage.dataset.story = this.state.id;
      this.swap(this.actors, scene.pose, "pose");
      this.swap(this.backgrounds, scene.bg, "background");
      this.root.querySelector(".scene-food").innerHTML =
        FOODS[scene.food] || "";
      this.refreshLocale();
    }
    play(id) {
      if (!Object.hasOwn(SCENES, id)) return;
      cancelAnimationFrame(this.frame);
      ++this.generation;
      this.state = { id, elapsed: 0, index: -1, paused: false, ended: false };
      this.root.classList.remove("hidden", "paused", "ended");
      this.root.scrollIntoView({ block: "start", behavior: "smooth" });
      this.applyStep(0);
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame((time) => this.tick(time));
    }
    tick(time) {
      if (!this.state || this.state.paused || this.state.ended) return;
      this.state.elapsed += Math.min(100, Math.max(0, time - this.lastTime));
      this.lastTime = time;
      const story = SCENES[this.state.id];
      let index = 0;
      for (
        let i = 1;
        i < story.steps.length && story.steps[i].at <= this.state.elapsed;
        i++
      )
        index = i;
      if (index !== this.state.index) this.applyStep(index);
      const progress = Math.min(
        100,
        (this.state.elapsed / story.duration) * 100,
      );
      this.root.querySelector(".scene-progress i").style.width = progress + "%";
      this.root
        .querySelector(".scene-progress")
        .setAttribute("aria-valuenow", Math.round(progress));
      if (this.state.elapsed >= story.duration) {
        this.state.ended = true;
        this.root.classList.add("ended");
        this.refreshLocale();
        return;
      }
      this.frame = requestAnimationFrame((next) => this.tick(next));
    }
    pause() {
      if (!this.state || this.state.ended) return;
      this.state.paused = true;
      cancelAnimationFrame(this.frame);
      this.root.classList.add("paused");
      this.refreshLocale();
    }
    resume() {
      if (!this.state || this.state.ended) return;
      this.state.paused = false;
      this.lastTime = performance.now();
      this.root.classList.remove("paused");
      this.refreshLocale();
      this.frame = requestAnimationFrame((time) => this.tick(time));
    }
    stop() {
      cancelAnimationFrame(this.frame);
      ++this.generation;
      this.state = null;
      this.root.classList.add("hidden");
    }
    refreshLocale() {
      const t = this.translate;
      this.root.querySelector("[data-control=pause]").textContent = t(
        this.state?.paused ? "▶ 继续" : "Ⅱ 暂停",
      );
      this.root.querySelector("[data-control=pause]").disabled =
        !this.state || this.state.ended;
      this.root.querySelector("[data-control=replay]").textContent =
        t("↻ 再看一次");
      this.root.querySelector("[data-control=end]").textContent = t("结束");
      this.root
        .querySelector(".scene-close")
        .setAttribute("aria-label", t("结束小场景"));
      this.root.querySelector(".scene-badge").textContent = t(
        this.state ? SCENES[this.state.id].title : "海风小剧场",
      );
      this.caption.textContent = t(
        this.currentScene?.caption || "选一个小场景，和米格瑞特一起出发吧。",
      );
    }
    getState() {
      return this.state ? { ...this.state } : null;
    }
  }
  return { SCENES, ScenePlayer };
});
