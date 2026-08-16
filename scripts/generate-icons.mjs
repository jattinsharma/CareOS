/**
 * Generates the KinOS PWA icons in public/icons/.
 *
 * Pure Node.js — no dependencies. Builds PNGs manually (zlib + CRC32) and
 * draws a rose-500 (#f43f5e) background with a white heart.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "icons");

const ROSE = [244, 63, 94]; // #f43f5e
const WHITE = [255, 255, 255];

/* ---------------- PNG encoding ---------------- */

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // bytes 10-12: compression=0, filter=0, interlace=0 (defaults)

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------------- Drawing ---------------- */

/**
 * Coverage of the white heart at normalized pixel coords (u, v) in [0, 1].
 * Uses the classic heart curve: (x^2 + y^2 - 1)^3 <= x^2 * y^3.
 * `factor` scales the heart relative to the canvas (larger = smaller heart).
 */
function heartAlpha(u, v, factor) {
  const x = (u - 0.5) * factor;
  // Flip v so the heart tip points down, and shift so the heart is visually centered.
  const y = (0.5 - v) * factor - 0.15;
  const a = x * x + y * y - 1;
  const f = a * a * a - x * x * y * y * y;
  // Smooth 1px-ish edge for anti-aliasing.
  const t = Math.min(Math.max(f / 0.06, 0), 1);
  return 1 - t;
}

function drawIcon(size, factor, filename) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const alpha = heartAlpha(u, v, factor);
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(ROSE[0] + (WHITE[0] - ROSE[0]) * alpha);
      rgba[i + 1] = Math.round(ROSE[1] + (WHITE[1] - ROSE[1]) * alpha);
      rgba[i + 2] = Math.round(ROSE[2] + (WHITE[2] - ROSE[2]) * alpha);
      rgba[i + 3] = 255;
    }
  }
  writeFileSync(join(OUT_DIR, filename), encodePNG(size, size, rgba));
  console.log("  ✓", filename, `(${size}x${size})`);
}

/* ---------------- Main ---------------- */

mkdirSync(OUT_DIR, { recursive: true });
console.log("Generating KinOS PWA icons...");

// Regular icons: heart fills ~65% of the canvas. Versioned filenames so
// installed PWAs (which cache icons aggressively, especially iOS) pick up
// changes on re-install — never reuse a previously-shipped filename.
drawIcon(192, 3.6, "icon-192-v2.png");
drawIcon(512, 3.6, "icon-512-v2.png");

// Maskable icons: heart kept well inside the 80% safe-zone circle.
drawIcon(192, 5.4, "maskable-icon-192x192.png");
drawIcon(512, 5.4, "maskable-icon-512x512.png");

console.log(`Done → ${OUT_DIR}`);
