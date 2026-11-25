// News image for Wednesday 25 November 2026 — make.fun news-image-20261125.
// A pure-stdlib Node program: it rasterises three illustrated panels into a
// 1024x1024 PNG (own tiny rasteriser + own PNG encoder, no dependencies,
// no network, no downloaded art) and writes it to /output/entry.png.
//
// The three stories, all first reported on 25 November 2026:
//   1. Two tankers hit mines in the Strait of Hormuz as the Iran war widens.
//   2. Pakistan's first astronaut reaches China's space station.
//   3. Every hostage freed after the supermarket siege in Cartagena, Colombia.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- pixels

const buf = new Uint8Array(W * H * 4);

// Optional clip rectangle: scene drawing stays inside its own panel so
// nothing (e.g. the Earth arc) spills onto a neighbour panel.
let clipX0 = 0;
let clipY0 = 0;
let clipX1 = W;
let clipY1 = H;

function setClip(x: number, y: number, w: number, h: number): void {
  clipX0 = x;
  clipY0 = y;
  clipX1 = x + w;
  clipY1 = y + h;
}

function clearClip(): void {
  clipX0 = 0;
  clipY0 = 0;
  clipX1 = W;
  clipY1 = H;
}

type RGB = [number, number, number];

function setPx(x: number, y: number, c: RGB): void {
  if (x < clipX0 || y < clipY0 || x >= clipX1 || y >= clipY1) return;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = 255;
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
  }
}

// Vertical gradient band.
function vgrad(x: number, y: number, w: number, h: number, top: RGB, bot: RGB): void {
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 0 : yy / (h - 1);
    const c: RGB = [
      Math.round(top[0] + (bot[0] - top[0]) * t),
      Math.round(top[1] + (bot[1] - top[1]) * t),
      Math.round(top[2] + (bot[2] - top[2]) * t),
    ];
    for (let xx = x; xx < x + w; xx++) setPx(xx, y + yy, c);
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = -r; yy <= r; yy++) {
    const span = Math.floor(Math.sqrt(r * r - yy * yy));
    for (let xx = -span; xx <= span; xx++) setPx(cx + xx, cy + yy, c);
  }
}

function ring(cx: number, cy: number, r: number, thick: number, c: RGB): void {
  for (let yy = -r - thick; yy <= r + thick; yy++) {
    for (let xx = -r - thick; xx <= r + thick; xx++) {
      const d = Math.sqrt(xx * xx + yy * yy);
      if (d >= r - thick && d <= r + thick) setPx(cx + xx, cy + yy, c);
    }
  }
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB, thick = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const px = Math.round(x0 + dx * t);
    const py = Math.round(y0 + dy * t);
    for (let a = 0; a < thick; a++) {
      for (let b = 0; b < thick; b++) setPx(px + a, py + b, c);
    }
  }
}

function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = (x1 - x) * (y2 - y) - (x2 - x) * (y1 - y);
      const w1 = (x2 - x) * (y0 - y) - (x0 - x) * (y2 - y);
      const w2 = (x0 - x) * (y1 - y) - (x1 - x) * (y0 - y);
      const inside = area > 0
        ? w0 >= 0 && w1 >= 0 && w2 >= 0
        : w0 <= 0 && w1 <= 0 && w2 <= 0;
      if (inside) setPx(x, y, c);
    }
  }
}

// A spiky explosion burst: alternating long/short rays as filled triangles
// plus a hot core, so it reads as a blast at small size.
function burst(cx: number, cy: number, r: number, core: RGB, flame: RGB): void {
  const spikes = 12;
  for (let k = 0; k < spikes; k++) {
    const a = (k / spikes) * Math.PI * 2;
    const a2 = ((k + 0.5) / spikes) * Math.PI * 2;
    const len = k % 2 === 0 ? r : r * 0.55;
    tri(
      cx, cy,
      Math.round(cx + Math.cos(a - 0.16) * len * 0.45),
      Math.round(cy + Math.sin(a - 0.16) * len * 0.45),
      Math.round(cx + Math.cos(a) * len),
      Math.round(cy + Math.sin(a) * len),
      flame,
    );
    void a2;
  }
  disc(cx, cy, Math.round(r * 0.45), core);
  disc(cx, cy, Math.round(r * 0.22), [255, 240, 180]);
}

// Small standing person: head disc + body rect + two leg lines.
function person(x: number, y: number, hgt: number, shirt: RGB, skin: RGB): void {
  const headR = Math.max(3, Math.round(hgt * 0.14));
  disc(x, y - hgt + headR, headR, skin);
  rect(x - Math.round(hgt * 0.11), y - hgt + headR * 2, Math.round(hgt * 0.22), Math.round(hgt * 0.45), shirt);
  line(x - 2, y - Math.round(hgt * 0.32), x - 4, y, [30, 30, 40], 2);
  line(x + 2, y - Math.round(hgt * 0.32), x + 4, y, [30, 30, 40], 2);
}

// ------------------------------------------------------------------- font
// Hand-drawn 5x7 bitmap glyphs, only the characters the captions need.

const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function textWidth(s: string, scale: number): number {
  return s.length === 0 ? 0 : s.length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT[' '];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === '1') {
          rect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentred(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// -------------------------------------------------------------------- png

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    raw.set(buf.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ scene

const NAVY: RGB = [13, 27, 48];
const GOLD: RGB = [232, 184, 74];
const PAPER: RGB = [245, 240, 225];
const INK: RGB = [20, 24, 34];

function panelFrame(x: number, y: number, w: number, h: number): void {
  rect(x - 3, y - 3, w + 6, h + 6, GOLD);
  rect(x, y, w, h, NAVY);
}

// Caption strip pinned to a panel's bottom edge.
function caption(x: number, y: number, w: number, line1: string, line2: string): void {
  rect(x, y, w, 86, [8, 14, 26]);
  rect(x, y, w, 3, GOLD);
  drawTextCentred(line1, x + w / 2, y + 12, 3, PAPER);
  drawTextCentred(line2, x + w / 2, y + 48, 3, [176, 196, 220]);
}

// --- Panel A: Strait of Hormuz — tanker, mines, blast at dusk.
function panelHormuz(x: number, y: number, w: number, h: number): void {
  panelFrame(x, y, w, h);
  setClip(x, y, w, h);
  vgrad(x, y, w, 250, [226, 122, 52], [122, 48, 74]); // dusk sky
  disc(x + 96, y + 92, 42, [255, 214, 130]); // low sun
  vgrad(x, y + 250, w, h - 250, [16, 96, 110], [8, 52, 74]); // sea
  // wave lines
  for (let k = 0; k < 5; k++) {
    const wy = y + 288 + k * 32;
    line(x + 20 + (k % 2) * 40, wy, x + w - 20 - (k % 2) * 30, wy, [120, 200, 215], 2);
  }
  // tanker: hull + stacked containers + bridge
  rect(x + 60, y + 268, 320, 42, [22, 30, 42]);
  tri(x + 380, y + 268, x + 430, y + 268, x + 380, y + 310, [22, 30, 42]);
  rect(x + 92, y + 226, 64, 42, [198, 74, 54]);
  rect(x + 164, y + 226, 64, 42, [232, 184, 74]);
  rect(x + 236, y + 226, 64, 42, [74, 140, 110]);
  rect(x + 308, y + 238, 44, 30, [120, 130, 150]);
  rect(x + 316, y + 196, 28, 42, [235, 238, 242]); // bridge tower
  rect(x + 320, y + 202, 20, 8, [40, 90, 120]);
  // blast above the bow + smoke
  burst(x + 400, y + 190, 46, [255, 176, 66], [232, 110, 40]);
  disc(x + 356, y + 168, 16, [90, 90, 100]);
  disc(x + 428, y + 158, 13, [110, 110, 118]);
  disc(x + 392, y + 142, 18, [74, 74, 84]);
  // naval mines drifting in the foreground, above the caption strip
  for (const [mx, my] of [[x + 66, y + 296], [x + 420, y + 306]] as const) {
    disc(mx, my, 12, [18, 20, 26]);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      line(mx, my, Math.round(mx + Math.cos(a) * 19), Math.round(my + Math.sin(a) * 19), [18, 20, 26], 2);
    }
  }
  clearClip();
  caption(x, y + h - 86, w, 'TANKERS HIT BY MINES', 'STRAIT OF HORMUZ');
}

// --- Panel B: space — Earth below, station and astronaut above.
function panelSpace(x: number, y: number, w: number, h: number): void {
  panelFrame(x, y, w, h);
  setClip(x, y, w, h);
  rect(x, y, w, h, [5, 9, 20]);
  // fixed star field (deterministic positions from a tiny hash)
  for (let k = 0; k < 90; k++) {
    const sx = x + ((k * 137 + 41) % (w - 12)) + 6;
    const sy = y + ((k * 211 + 97) % (h - 170)) + 6;
    const s = k % 7 === 0 ? 2 : 1;
    rect(sx, sy, s, s, [220, 228, 245]);
  }
  // Earth arc rising from the bottom
  disc(x + w / 2, y + h + 330, 470, [34, 110, 196]);
  disc(x + w / 2 - 130, y + h + 180, 150, [46, 138, 90]);
  disc(x + w / 2 + 170, y + h + 150, 110, [46, 138, 90]);
  disc(x + w / 2 + 40, y + h + 210, 90, [52, 150, 96]);
  ring(x + w / 2, y + h + 330, 470, 2, [120, 190, 255]);
  // space station: core module, node, gold solar wings
  rect(x + 150, y + 128, 170, 34, [228, 232, 238]);
  rect(x + 216, y + 96, 38, 98, [200, 206, 214]);
  rect(x + 210, y + 92, 50, 10, [150, 158, 170]);
  rect(x + 60, y + 138, 84, 14, [196, 150, 52]);
  rect(x + 326, y + 138, 84, 14, [196, 150, 52]);
  line(x + 144, y + 145, x + 150, y + 145, [160, 166, 176], 3);
  line(x + 320, y + 145, x + 326, y + 145, [160, 166, 176], 3);
  // astronaut on a tether, drifting right of the station
  line(x + 330, y + 180, x + 392, y + 216, [200, 206, 214], 2);
  disc(x + 398, y + 232, 13, [238, 242, 246]);
  disc(x + 398, y + 232, 13, [238, 242, 246]);
  rect(x + 386, y + 244, 24, 30, [238, 242, 246]);
  rect(x + 378, y + 246, 8, 22, [238, 242, 246]);
  rect(x + 404, y + 246, 8, 22, [238, 242, 246]);
  rect(x + 388, y + 274, 8, 20, [210, 214, 220]);
  rect(x + 398, y + 274, 8, 20, [210, 214, 220]);
  disc(x + 398, y + 232, 7, [52, 120, 170]); // visor
  clearClip();
  caption(x, y + h - 86, w, "PAKISTAN'S FIRST ASTRONAUT", 'REACHES CHINESE STATION');
}

// --- Panel C: Cartagena — supermarket, police, freed hostages walking out.
function panelCartagena(x: number, y: number, w: number, h: number): void {
  panelFrame(x, y, w, h);
  setClip(x, y, w, h);
  vgrad(x, y, w, 240, [168, 208, 232], [232, 226, 196]); // morning sky
  disc(x + 860, y + 74, 40, [255, 222, 130]); // sun
  // street
  rect(x, y + 300, w, h - 300, [96, 96, 100]);
  rect(x, y + 300, w, 6, [220, 220, 210]);
  // supermarket block
  rect(x + 60, y + 88, 560, 212, [240, 232, 210]);
  rect(x + 60, y + 88, 560, 52, [178, 44, 44]); // sign band
  drawText('SUPERMARKET', x + 96, y + 100, 5, PAPER);
  // glass front + doors
  rect(x + 84, y + 164, 180, 136, [120, 170, 196]);
  rect(x + 288, y + 164, 130, 136, [120, 170, 196]);
  rect(x + 442, y + 164, 154, 136, [150, 190, 210]);
  line(x + 174, y + 164, x + 174, y + 300, [240, 232, 210], 4);
  line(x + 353, y + 164, x + 353, y + 300, [240, 232, 210], 4);
  // awning stripes over the doors
  for (let k = 0; k < 8; k++) {
    rect(x + 84 + k * 64, y + 152, 32, 12, k % 2 === 0 ? [178, 44, 44] : PAPER);
  }
  // a second small shopfront to the right
  rect(x + 660, y + 150, 240, 150, [214, 196, 150]);
  rect(x + 684, y + 176, 90, 60, [120, 170, 196]);
  rect(x + 798, y + 176, 78, 60, [120, 170, 196]);
  drawText('TIENDA', x + 700, y + 250, 3, [90, 60, 30]);
  // police at both flanks, feet just above the caption strip
  person(x + 120, y + 336, 52, [28, 52, 110], [210, 170, 130]);
  person(x + 880, y + 336, 52, [28, 52, 110], [190, 150, 115]);
  // freed shoppers walking out together, centre street
  const crowd: [number, RGB][] = [
    [300, [52, 140, 96]], [360, [198, 120, 54]], [420, [90, 110, 180]],
    [480, [178, 74, 110]], [540, [60, 130, 130]], [600, [140, 90, 150]],
    [660, [200, 90, 60]], [720, [70, 120, 70]],
  ];
  for (const [cx, shirt] of crowd) {
    person(cx, y + 338, 48, shirt, [205, 165, 125]);
  }
  clearClip();
  caption(x, y + h - 86, w, 'ALL HOSTAGES FREED', 'CARTAGENA SUPERMARKET SIEGE ENDS');
}

// -------------------------------------------------------------------- main

function main(): void {
  // Background + header.
  rect(0, 0, W, H, NAVY);
  drawTextCentred('WORLD NEWS', W / 2, 16, 9, PAPER);
  drawTextCentred('WEDNESDAY 25 NOVEMBER 2026', W / 2, 84, 4, GOLD);
  rect(24, 122, W - 48, 3, GOLD);

  panelHormuz(24, 140, 476, 408);
  panelSpace(524, 140, 476, 408);
  panelCartagena(24, 572, 976, 428);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const png = encodePng();
  writeFileSync(join(outDir, 'entry.png'), png);
  console.log(`wrote entry.png (${png.length} bytes, ${W}x${H})`);
}

main();
