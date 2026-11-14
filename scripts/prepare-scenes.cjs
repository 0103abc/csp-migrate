"use strict";
const sharp = require("sharp"),
  path = require("node:path");
const dir = path.resolve(__dirname, "../assets");
(async () => {
  const atlas = path.join(dir, "scenes-atlas.png"),
    meta = await sharp(atlas).metadata();
  const names = [
    "invite",
    "follow",
    "eat-rest",
    "eat-lift",
    "eat-bite",
    "eat-happy",
    "offer-cake",
    "offer-pudding",
  ];
  for (let index = 0; index < names.length; index++) {
    const col = index % 4,
      row = Math.floor(index / 4),
      left = Math.round((col * meta.width) / 4),
      top = Math.round((row * meta.height) / 2);
    const cell = await sharp(atlas)
      .extract({
        left,
        top,
        width: Math.round(((col + 1) * meta.width) / 4) - left,
        height: Math.round(((row + 1) * meta.height) / 2) - top,
      })
      .png()
      .toBuffer();
    await sharp(cell)
      .trim()
      .resize(400, 560, { fit: "contain", background: "#00000000" })
      .png()
      .toFile(path.join(dir, `scene-${names[index]}.png`));
  }
  const background = path.join(dir, "home-backgrounds-atlas.png"),
    bg = await sharp(background).metadata();
  for (let index = 0; index < 2; index++) {
    const left = Math.round((index * bg.width) / 2),
      width = Math.round(((index + 1) * bg.width) / 2) - left;
    await sharp(background)
      .extract({ left, top: 0, width, height: bg.height })
      .resize(1152, 768, { fit: "cover" })
      .jpeg({ quality: 90 })
      .toFile(path.join(dir, index ? "scene-home.jpg" : "scene-coast.jpg"));
  }
  console.log("Prepared eight scene poses and two backgrounds.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
