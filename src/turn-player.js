(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MigrateTurnPlayer = factory();
})(globalThis, function () {
  "use strict";
  const TURN_POSES = Object.freeze(["idle", "side", "back"]);
  const smooth = (p) => p * p * (3 - 2 * p);
  function sampleFrames(progress, reverse = false, count = 16) {
    const angle = smooth(Math.max(0, Math.min(1, progress))) * (count - 1),
      value = reverse ? count - 1 - angle : angle;
    return {
      lower: Math.floor(value),
      upper: Math.min(count - 1, Math.floor(value) + 1),
      blend: value - Math.floor(value),
    };
  }
  function sampleTurn(progress, reverse = false) {
    let p = smooth(Math.max(0, Math.min(1, progress)));
    if (reverse) p = 1 - p;
    const index = Math.min(1, Math.floor(p * 2));
    return { from: index, to: index + 1, weight: smooth(p * 2 - index) };
  }
  // Landmarks come from the original three poses, in their original PNG pixels.
  // Only geometry moves: no regenerated artwork, color filter or lighting layer.
  const POINTS = [
    [
      [184, 78],
      [63, 112],
      [305, 84],
      [195, 161],
      [187, 211],
      [184, 277],
      [182, 337],
      [172, 469],
      [206, 469],
    ],
    [
      [211, 77],
      [112, 112],
      [310, 82],
      [257, 164],
      [226, 213],
      [223, 277],
      [214, 336],
      [168, 466],
      [291, 458],
    ],
    [
      [190, 81],
      [48, 115],
      [317, 110],
      [193, 162],
      [193, 219],
      [193, 279],
      [192, 338],
      [184, 470],
      [215, 470],
    ],
  ];
  const WIDTH = 640,
    HEIGHT = 654,
    COLS = 6,
    ROWS = 8;
  function canvas() {
    const c = document.createElement("canvas");
    c.width = WIDTH;
    c.height = HEIGHT;
    return c;
  }
  function fit(image) {
    const scale = Math.min(
      WIDTH / image.naturalWidth,
      HEIGHT / image.naturalHeight,
    );
    return {
      x: (WIDTH - image.naturalWidth * scale) / 2,
      y: (HEIGHT - image.naturalHeight * scale) / 2,
      w: image.naturalWidth * scale,
      h: image.naturalHeight * scale,
      scale,
    };
  }
  function paintOriginal(ctx, image) {
    const r = fit(image);
    ctx.drawImage(image, r.x, r.y, r.w, r.h);
  }
  function mesh(points, other, amount) {
    const result = [];
    for (let row = 0; row <= ROWS; row++)
      for (let col = 0; col <= COLS; col++) {
        const x = (col * WIDTH) / COLS,
          y = (row * HEIGHT) / ROWS;
        let dx = 0,
          dy = 0,
          total = 0.2;
        if (row !== 0 && row !== ROWS && col !== 0 && col !== COLS)
          for (let i = 0; i < points.length; i++) {
            const w = Math.exp(
              -((x - points[i][0]) ** 2 + (y - points[i][1]) ** 2) /
                (2 * 100 ** 2),
            );
            dx += (other[i][0] - points[i][0]) * w;
            dy += (other[i][1] - points[i][1]) * w;
            total += w;
          }
        result.push({
          x: x + (amount * dx) / total,
          y: y + (amount * dy) / total,
          sx: x,
          sy: y,
        });
      }
    return result;
  }
  function triangle(ctx, texture, points) {
    const [s0, s1, s2] = points;
    const den =
      s0.sx * (s1.sy - s2.sy) +
      s1.sx * (s2.sy - s0.sy) +
      s2.sx * (s0.sy - s1.sy);
    const coefficients = (axis) => [
      (s0[axis] * (s1.sy - s2.sy) +
        s1[axis] * (s2.sy - s0.sy) +
        s2[axis] * (s0.sy - s1.sy)) /
        den,
      (s0[axis] * (s2.sx - s1.sx) +
        s1[axis] * (s0.sx - s2.sx) +
        s2[axis] * (s1.sx - s0.sx)) /
        den,
      (s0[axis] * (s1.sx * s2.sy - s2.sx * s1.sy) +
        s1[axis] * (s2.sx * s0.sy - s0.sx * s2.sy) +
        s2[axis] * (s0.sx * s1.sy - s1.sx * s0.sy)) /
        den,
    ];
    const [a, c, e] = coefficients("x"),
      [b, d, f] = coefficients("y");
    ctx.save();
    ctx.beginPath();
    const cx = (s0.x + s1.x + s2.x) / 3,
      cy = (s0.y + s1.y + s2.y) / 3;
    points.forEach((p, i) => {
      const dx = p.x - cx,
        dy = p.y - cy,
        length = Math.hypot(dx, dy) || 1,
        x = p.x + (0.35 * dx) / length,
        y = p.y + (0.35 * dy) / length;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(texture, 0, 0);
    ctx.restore();
  }
  class TurnPlayer {
    constructor(output, sprite) {
      this.canvas = output;
      this.sprite = sprite;
      this.generation = 0;
      this.raf = null;
      this.settle = null;
      this.images = TURN_POSES.map((name) => {
        const img = new Image();
        img.src = `../assets/${name}.png`;
        return img;
      });
      this.layers = [canvas(), canvas()];
      this.ready = Promise.all(this.images.map((img) => img.decode())).then(
        () => {
          this.textures = this.images.map((img) => {
            const c = canvas();
            paintOriginal(c.getContext("2d"), img);
            return c;
          });
          this.points = this.images.map((img, index) => {
            const r = fit(img);
            return POINTS[index].map(([x, y]) => [
              r.x + x * r.scale,
              r.y + y * r.scale,
            ]);
          });
        },
      );
    }
    cancel() {
      this.generation++;
      cancelAnimationFrame(this.raf);
      this.canvas.style.opacity = "0";
      this.sprite.style.opacity = "";
      if (this.settle) {
        this.settle(false);
        this.settle = null;
      }
    }
    drawAt(progress, reverse = false) {
      const out = this.canvas;
      if (out.width !== WIDTH || out.height !== HEIGHT) {
        out.width = WIDTH;
        out.height = HEIGHT;
      }
      const ctx = out.getContext("2d"),
        state = sampleTurn(progress, reverse);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      if (state.weight < 0.001 || state.weight > 0.999) {
        paintOriginal(
          ctx,
          this.images[state.weight < 0.001 ? state.from : state.to],
        );
        return;
      }
      for (let side = 0; side < 2; side++) {
        const index = side ? state.to : state.from,
          other = side ? state.from : state.to,
          amount = side ? 1 - state.weight : state.weight;
        const layer = this.layers[side],
          lc = layer.getContext("2d");
        lc.clearRect(0, 0, WIDTH, HEIGHT);
        const vertices = mesh(this.points[index], this.points[other], amount);
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++) {
            const a = y * (COLS + 1) + x,
              b = a + 1,
              c = a + COLS + 1,
              d = c + 1;
            triangle(lc, this.textures[index], [
              vertices[a],
              vertices[b],
              vertices[d],
            ]);
            triangle(lc, this.textures[index], [
              vertices[a],
              vertices[d],
              vertices[c],
            ]);
          }
      }
      // Most of the movement uses a single original texture. Limit the texture
      // hand-off to a short interval so the figure never looks double-exposed.
      const mix = smooth(
        Math.max(0, Math.min(1, (state.weight - 0.44) / 0.12)),
      );
      ctx.globalAlpha = 1 - mix;
      ctx.drawImage(this.layers[0], 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = mix;
      ctx.drawImage(this.layers[1], 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    async play(reverse, targetUrl) {
      this.cancel();
      const generation = this.generation;
      try {
        await this.ready;
      } catch {
        return false;
      }
      if (generation !== this.generation) return false;
      const target = new Image();
      target.src = targetUrl;
      await target.decode().catch(() => {});
      if (generation !== this.generation) return false;
      return new Promise((resolve) => {
        this.settle = resolve;
        let start;
        const tick = (now) => {
          if (generation !== this.generation) return;
          if (start === undefined) start = now;
          const p = Math.min(1, (now - start) / 1540);
          this.drawAt(p, reverse);
          this.canvas.dataset.frame = String(sampleFrames(p, reverse).lower);
          this.canvas.dataset.progress = String(p);
          this.canvas.style.opacity = "1";
          this.sprite.style.opacity = "0";
          if (p === 1) {
            this.sprite.src = targetUrl;
            this.sprite.style.opacity = "";
            this.canvas.style.opacity = "0";
            this.settle = null;
            resolve(true);
          } else this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
      });
    }
  }
  return { TurnPlayer, sampleFrames, sampleTurn, TURN_POSES };
});
