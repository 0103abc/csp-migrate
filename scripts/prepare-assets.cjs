"use strict";
const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, ".."),
  dir = path.join(root, "assets");
(async () => {
  const atlas = path.join(dir, "migrate-atlas.png");
  const meta = await sharp(atlas).metadata();
  if (!meta.hasAlpha)
    throw new Error("Character atlas must have an alpha channel.");
  const names = [
    "idle",
    "wave",
    "side",
    "back",
    "sleep",
    "magic",
    "happy",
    "talk",
  ];
  for (let index = 0; index < names.length; index++) {
    const column = index % 4,
      row = Math.floor(index / 4);
    const left = Math.round((column * meta.width) / 4),
      top = Math.round((row * meta.height) / 2);
    const width = Math.round(((column + 1) * meta.width) / 4) - left,
      height = Math.round(((row + 1) * meta.height) / 2) - top;
    await sharp(atlas)
      .extract({ left, top, width, height })
      .resize(362, 543, { fit: "fill" })
      .png()
      .toFile(path.join(dir, `${names[index]}.png`));
  }
  await sharp(path.join(dir, "idle.png"))
    .extract({ left: 32, top: 38, width: 288, height: 250 })
    .resize(256, 256)
    .png()
    .toFile(path.join(dir, "portrait.png"));
  await sharp(path.join(dir, "portrait.png"))
    .resize(256, 256)
    .png()
    .toFile(path.join(dir, "icon.png"));
  // Tray uses a code-drawn compass mark so it remains legible at 16 pixels.
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#1a3c5b" stroke="#d4bd88" stroke-width="3"/><path d="m32 8 7 17 17 7-17 7-7 17-7-17-17-7 17-7z" fill="#d4bd88"/><path d="m32 17 4 11 11 4-11 4-4 11-4-11-11-4 11-4z" fill="#e8f5ff"/><circle cx="32" cy="32" r="4" fill="#598ab1"/></svg>',
  );
  await sharp(svg).resize(32, 32).png().toFile(path.join(dir, "tray.png"));
  const png = await sharp(path.join(dir, "icon.png"))
    .resize(256, 256)
    .png()
    .toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(dir, "icon.ico"), Buffer.concat([header, png]));
  console.log(
    `Prepared ${names.length} sprites, portrait, tray and app icons.`,
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
