// Генератор placeholder-иконок и splash-экранов PWA (без зависимостей).
// Запуск: node scripts/generate-icons.mjs
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');
mkdirSync(resolve(PUBLIC, 'splash'), { recursive: true });

// ---- PNG-кодек ----
const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- Рисование ----
const BG = [10, 15, 26, 255]; // ink-950
const PANEL = [0, 166, 224, 255]; // brand
const WHITE = [255, 255, 255, 255];

function makeCanvas(W, H, bg) {
  const buf = Buffer.alloc(W * H * 4);
  const set = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3];
  };
  if (bg) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, bg);
  return { buf, set };
}

// Логотип со стороной S в точке (ox, oy)
function drawLogo(set, S, ox, oy) {
  const pad = Math.round(S * 0.12);
  const r = Math.round(S * 0.22);
  const x0 = ox + pad;
  const y0 = oy + pad;
  const x1 = ox + S - pad - 1;
  const y1 = oy + S - pad - 1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = Math.max(x0 + r - x, x - (x1 - r), 0);
      const dy = Math.max(y0 + r - y, y - (y1 - r), 0);
      if (dx * dx + dy * dy <= r * r) set(x, y, PANEL);
    }
  }
  const th = Math.max(2, Math.round(S * 0.085));
  const pts = [
    [0.27, 0.34], [0.4, 0.66], [0.5, 0.46], [0.6, 0.66], [0.73, 0.34],
  ].map(([fx, fy]) => [ox + fx * S, oy + fy * S]);
  const stamp = (cx, cy) => {
    const h = Math.floor(th / 2);
    for (let yy = -h; yy <= h; yy++) for (let xx = -h; xx <= h; xx++) set(cx + xx, cy + yy, WHITE);
  };
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, ay] = pts[s];
    const [bx, by] = pts[s + 1];
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let i = 0; i <= steps; i++) stamp(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps);
  }
}

function makeIcon(size) {
  const { buf, set } = makeCanvas(size, size, BG);
  drawLogo(set, size, 0, 0);
  return encodePNG(size, size, buf);
}

function makeSplash(W, H) {
  const { buf, set } = makeCanvas(W, H, BG);
  const S = Math.round(Math.min(W, H) * 0.34);
  drawLogo(set, S, (W - S) / 2, (H - S) / 2);
  return encodePNG(W, H, buf);
}

// ---- Иконки ----
for (const [name, size] of [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32x32.png', 32],
]) {
  writeFileSync(resolve(PUBLIC, name), makeIcon(size));
  console.log('icon', name);
}

// ---- Splash-экраны (актуальные iPhone, портрет) ----
// [ширина_px, высота_px]
const SPLASHES = [
  [1290, 2796], [1179, 2556], [1284, 2778], [1170, 2532],
  [1125, 2436], [1242, 2688], [828, 1792], [750, 1334],
];
for (const [w, h] of SPLASHES) {
  writeFileSync(resolve(PUBLIC, 'splash', `splash-${w}x${h}.png`), makeSplash(w, h));
  console.log('splash', `${w}x${h}`);
}
