(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MigrateTurnPlayer = factory();
})(globalThis, function () {
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
  class TurnPlayer {
    constructor(canvas, sprite) {
      this.canvas = canvas;
      this.sprite = sprite;
      this.generation = 0;
      this.raf = null;
      this.settle = null;
      this.image = new Image();
      this.image.src = "../assets/turn-strip.png";
      this.ready = this.image.decode();
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
      const ctx = this.canvas.getContext("2d"),
        width = 640,
        height = 654,
        duration = 1540;
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvas.dataset.frame = reverse ? "15" : "0";
      this.canvas.dataset.progress = "0";
      return new Promise((resolve) => {
        this.settle = resolve;
        let start;
        const tick = (now) => {
          if (generation !== this.generation) return;
          if (start === undefined) start = now;
          const p = Math.min(1, (now - start) / duration),
            movement = Math.max(0, Math.min(1, (p - 0.08) / 0.84));
          const f = sampleFrames(movement, reverse);
          ctx.clearRect(0, 0, width, height);
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1 - f.blend;
          ctx.drawImage(
            this.image,
            f.lower * width,
            0,
            width,
            height,
            0,
            0,
            width,
            height,
          );
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = f.blend;
          ctx.drawImage(
            this.image,
            f.upper * width,
            0,
            width,
            height,
            0,
            0,
            width,
            height,
          );
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
          this.canvas.dataset.frame = String(f.lower);
          this.canvas.dataset.progress = String(p);
          if (p < 0.08) {
            this.canvas.style.opacity = String(p / 0.08);
            this.sprite.style.opacity = String(1 - p / 0.08);
          } else if (p > 0.92) {
            this.sprite.src = targetUrl;
            const fade = (p - 0.92) / 0.08;
            this.canvas.style.opacity = String(1 - fade);
            this.sprite.style.opacity = String(fade);
          } else {
            this.canvas.style.opacity = "1";
            this.sprite.style.opacity = "0";
          }
          if (p === 1) {
            this.canvas.style.opacity = "0";
            this.sprite.src = targetUrl;
            this.sprite.style.opacity = "";
            this.settle = null;
            resolve(true);
          } else this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
      });
    }
  }
  return { TurnPlayer, sampleFrames };
});
