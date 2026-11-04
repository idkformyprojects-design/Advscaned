/**
 * Generates PNG app icons (192 / 512 / maskable) with no image dependencies.
 * Run: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// Signed distance to a rounded rectangle centred at (cx, cy).
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

// Ring segment (handle) — distance to a circle, only upper half.
function sdHandle(px, py, cx, cy, radius, thickness, yMin) {
  const d = Math.abs(Math.hypot(px - cx, py - cy) - radius) - thickness / 2;
  return Math.max(d, py - yMin);
}

function drawIcon(size, maskable) {
  const SS = 2; // supersampling
  const buf = Buffer.alloc(size * size * 4);
  const inset = maskable ? 0.18 : 0.0; // maskable safe zone
  const bgRadius = maskable ? 0 : size * 0.235;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          // background
          const bgD = maskable
            ? -1
            : sdRoundRect(px, py, size / 2, size / 2, size / 2, size / 2, bgRadius);
          const bgA = maskable ? 1 : smooth(0.8, -0.8, bgD);
          // diagonal gradient
          const t = clamp((px / size) * 0.35 + (py / size) * 0.65);
          let cr = mix(10, 5, t);
          let cg = mix(169, 110, t);
          let cb = mix(140, 94, t);

          const scale = maskable ? 1 - inset * 1.25 : 1;
          const u = (px - size / 2) / scale + size / 2;
          const v = (py - size / 2) / scale + size / 2;

          // bag body
          const bagD = sdRoundRect(
            u,
            v,
            size / 2,
            size * 0.6,
            size * 0.235,
            size * 0.17,
            size * 0.06,
          );
          const handleD = sdHandle(
            u,
            v,
            size / 2,
            size * 0.43,
            size * 0.135,
            size * 0.045,
            size * 0.43,
          );
          const strokeIn = size * 0.045;
          const bagStroke =
            smooth(strokeIn / 2 + 0.6, strokeIn / 2 - 0.6, Math.abs(bagD) - strokeIn / 2) *
            smooth(0.8, -0.8, bagD + size * 0.13);
          const handleStroke = smooth(
            strokeIn / 2 + 0.6,
            strokeIn / 2 - 0.6,
            Math.abs(handleD) - strokeIn / 2,
          );
          const white = Math.max(bagStroke, handleStroke);

          cr = mix(cr, 255, white);
          cg = mix(cg, 255, white);
          cb = mix(cb, 255, white);
          r += cr * bgA;
          g += cg * bgA;
          b += cb * bgA;
          a += bgA;
        }
      }
      const n = SS * SS;
      const idx = (y * size + x) * 4;
      buf[idx] = Math.round(r / n);
      buf[idx + 1] = Math.round(g / n);
      buf[idx + 2] = Math.round(b / n);
      buf[idx + 3] = Math.round((a / n) * 255);
    }
  }
  return png(size, size, buf);
}

// Transparent white glyph for Android adaptive icons.
function drawGlyph(size) {
  const SS = 2;
  const buf = Buffer.alloc(size * size * 4);
  const scale = 0.62; // keep inside the adaptive mask safe zone
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let alpha = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const u = (px - size / 2) / scale + size / 2;
          const v = (py - size / 2) / scale + size / 2;
          const bagD = sdRoundRect(
            u,
            v,
            size / 2,
            size * 0.6,
            size * 0.235,
            size * 0.17,
            size * 0.06,
          );
          const handleD = sdHandle(
            u,
            v,
            size / 2,
            size * 0.43,
            size * 0.135,
            size * 0.045,
            size * 0.43,
          );
          const strokeIn = size * 0.045;
          const bagStroke =
            smooth(strokeIn / 2 + 0.6, strokeIn / 2 - 0.6, Math.abs(bagD) - strokeIn / 2) *
            smooth(0.8, -0.8, bagD + size * 0.13);
          const handleStroke = smooth(
            strokeIn / 2 + 0.6,
            strokeIn / 2 - 0.6,
            Math.abs(handleD) - strokeIn / 2,
          );
          alpha += Math.max(bagStroke, handleStroke);
        }
      }
      const idx = (y * size + x) * 4;
      buf[idx] = 255;
      buf[idx + 1] = 255;
      buf[idx + 2] = 255;
      buf[idx + 3] = Math.round((alpha / (SS * SS)) * 255);
    }
  }
  return png(size, size, buf);
}

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });
const write = (name, data) =>
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), data);

write('icon-192.png', drawIcon(192, false));
write('icon-512.png', drawIcon(512, false));
write('icon-maskable-512.png', drawIcon(512, true));
write('apple-touch-icon.png', drawIcon(180, false));
// Android launcher icons, if the native project exists.
const androidRes = new URL('../android/app/src/main/res/', import.meta.url);
const densities = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
];
try {
  for (const [density, iconSize, fgSize] of densities) {
    const dir = new URL(`mipmap-${density}/`, androidRes);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('ic_launcher.png', dir), drawIcon(iconSize, false));
    writeFileSync(new URL('ic_launcher_round.png', dir), drawIcon(iconSize, true));
    writeFileSync(new URL('ic_launcher_foreground.png', dir), drawGlyph(fgSize));
  }
  const valuesDir = new URL('values/', androidRes);
  mkdirSync(valuesDir, { recursive: true });
  writeFileSync(
    new URL('ic_launcher_background.xml', valuesDir),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#067A66</color>\n</resources>\n',
  );
  console.log('android launcher icons written');
} catch {
  console.log('android project not found — skipped launcher icons');
}

console.log('icons written');
