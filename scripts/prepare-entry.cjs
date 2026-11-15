"use strict";
const sharp = require("sharp"),
  path = require("node:path");
(async () => {
  const dir = path.resolve(__dirname, "../assets"),
    source = path.join(dir, "entry-atlas.png"),
    meta = await sharp(source).metadata();
  const names = ["remove-shoe", "place-shoes", "home-welcome", "door-boots"];
  for (let i = 0; i < 4; i++) {
    const left = Math.round((i * meta.width) / 4),
      width = Math.round(((i + 1) * meta.width) / 4) - left;
    const tile = await sharp(source)
      .extract({
        left,
        top: 0,
        width,
        height: meta.height,
      })
      .png()
      .toBuffer();
    let sprite = sharp(tile);
    if (i === 3)
      sprite = sprite.trim({ background: "#00000000", threshold: 10 });
    await sprite
      .resize(i === 3 ? 240 : 396, i === 3 ? 240 : 550, {
        fit: "contain",
        background: "#00000000",
      })
      .png()
      .toFile(path.join(dir, `scene-${names[i]}.png`));
  }
  console.log("Prepared doorway poses and boots.");
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
