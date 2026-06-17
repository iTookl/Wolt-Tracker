// Генератор placeholder-иконок PWA (без зависимостей).
// Рисует брендовый фон + белую «W». Запуск: node scripts/generate-icons.mjs
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');
mkdirSync(PUBLIC, { recursive: true });

// CRC32
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Цвета
const BG = [10, 15, 26, 255]; // ink-950
const PANEL = [0, 166, 224, 255]; // brand
const WHITE = [255, 255, 255, 255];

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3];
  };
  // фон
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BG);
  // скруглённая брендовая плашка
  const pad = Math.round(size * 0.12);
  const r = Math.round(size * 0.22);
  for (let y = pad; y < size - pad; y++) {
    for (let x = pad; x < size - pad; x++) {
      const dx = Math.max(pad + r - x, x - (size - pad - 1 - r), 0);
      const dy = Math.max(pad + r - y, y - (size - pad - 1 - r), 0);
      if (dx * dx + dy * dy <= r * r) set(x, y, PANEL);
    }
  }
  // буква W белыми штрихами
  const th = Math.max(2, Math.round(size * 0.085));
  const pts = [
    [0.27, 0.34], [0.4, 0.66], [0.5, 0.46], [0.6, 0.66], [0.73, 0.34],
  ].map(([fx, fy]) => [fx * size, fy * size]);
  const stamp = (cx, cy) => {
    const h = Math.floor(th / 2);
    for (let yy = -h; yy <= h; yy++) for (let xx = -h; xx <= h; xx++) set(Math.round(cx + xx), Math.round(cy + yy), WHITE);
  };
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, y0] = pts[s];
    const [x1, y1] = pts[s + 1];
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= steps; i++) stamp(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
  }
  return encodePNG(size, size, buf);
}

const targets = [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32x32.png', 32],
];
for (const [name, size] of targets) {
  writeFileSync(resolve(PUBLIC, name), drawIcon(size));
  console.log('written', name, size);
}
