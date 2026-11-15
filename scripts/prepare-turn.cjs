"use strict";
const sharp = require("sharp"),
  fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const dir = path.resolve(__dirname, "../assets"),
    input = path.join(dir, "turn-atlas.png"),
    meta = await sharp(input).metadata(),
    cells = [];
  for (let i = 0; i < 16; i++) {
    const c = i % 4,
      r = Math.floor(i / 4),
      left = Math.round((c * meta.width) / 4),
      top = Math.round((r * meta.height) / 4),
      width = Math.round(((c + 1) * meta.width) / 4) - left,
      height = Math.round(((r + 1) * meta.height) / 4) - top;
    const png = await sharp(input)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
    const raw = await sharp(png).ensureAlpha().raw().toBuffer();
    let foot = height - 1;
    while (foot > 0) {
      let n = 0;
      for (let x = 0; x < width; x++)
        if (raw[(foot * width + x) * 4 + 3] > 170) n++;
      if (n >= 10) break;
      foot--;
    }
    let sum = 0,
      weight = 0;
    for (let y = Math.max(0, foot - 10); y <= foot; y++)
      for (let x = 0; x < width; x++) {
        const a = raw[(y * width + x) * 4 + 3];
        if (a > 170) {
          sum += x * a;
          weight += a;
        }
      }
    const anchor = weight ? sum / weight : width / 2;
    cells.push({ png, width, height, foot, anchor });
  }
  const w = 640,
    h = 654;
  const ref = await sharp(path.join(dir, "idle.png"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let refFoot = ref.info.height - 1;
  while (refFoot > 0) {
    let n = 0;
    for (let x = 0; x < ref.info.width; x++)
      if (ref.data[(refFoot * ref.info.width + x) * 4 + 3] > 170) n++;
    if (n >= 10) break;
    refFoot--;
  }
  let refSum = 0,
    refWeight = 0;
  for (let y = Math.max(0, refFoot - 12); y <= refFoot; y++)
    for (let x = 0; x < ref.info.width; x++) {
      const a = ref.data[(y * ref.info.width + x) * 4 + 3];
      if (a > 170) {
        refSum += x * a;
        refWeight += a;
      }
    }
  const refScale = Math.min(464 / ref.info.width, h / ref.info.height),
    anchorX =
      (w - ref.info.width * refScale) / 2 + (refSum / refWeight) * refScale,
    base = (h - ref.info.height * refScale) / 2 + refFoot * refScale;
  // One global scale avoids a character that grows and shrinks while turning.
  const scale = Math.min(
    ...cells.map((c) =>
      Math.min(
        (anchorX - 8) / c.anchor,
        (w - anchorX - 8) / (c.width - c.anchor),
        (base - 8) / c.foot,
        (h - base - 4) / Math.max(1, c.height - c.foot),
      ),
    ),
  );
  const pieces = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i],
      width = Math.round(c.width * scale),
      height = Math.round(c.height * scale),
      left = Math.round(anchorX - c.anchor * scale),
      top = Math.round(base - c.foot * scale);
    const png = await sharp(c.png).resize(width, height).png().toBuffer();
    const frame = await sharp({
      create: { width: w, height: h, channels: 4, background: "#00000000" },
    })
      .composite([{ input: png, left, top }])
      .png()
      .toBuffer();
    pieces.push({ input: frame, left: i * w, top: 0 });
  }
  await sharp({
    create: { width: w * 16, height: h, channels: 4, background: "#00000000" },
  })
    .composite(pieces)
    .png()
    .toFile(path.join(dir, "turn-strip.png"));
  for (const [index, name] of [
    [0, "standing-front"],
    [15, "standing-back"],
  ])
    await sharp(path.join(dir, "turn-strip.png"))
      .extract({ left: index * w, top: 0, width: w, height: h })
      .png()
      .toFile(path.join(dir, name + ".png"));
  fs.writeFileSync(
    path.join(dir, "turn-strip.json"),
    JSON.stringify({
      frames: 16,
      width: w,
      height: h,
      duration: 1540,
      scale,
      footBaseline: base,
    }),
  );
  console.log(
    JSON.stringify({
      frames: 16,
      width: w,
      height: h,
      scale,
      anchors: cells.map((c) => Math.round(c.anchor)),
    }),
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
