import type Phaser from 'phaser';
import { PEN, T, TILE, TILE_COUNT } from './mapgen';
import { CROP_IDS, type CropId } from './crops';

/**
 * 모든 그림을 코드로 그려 텍스처로 등록한다(외부 이미지 파일 없음).
 * 나중에 그림 파일로 바꿀 때는 같은 키 이름으로 이미지를 불러오면 된다.
 */

type Ctx = CanvasRenderingContext2D;

function mk(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function rnd(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

function circle(c: Ctx, x: number, y: number, r: number, fill: string): void {
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string): void {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

function poly(c: Ctx, pts: number[], fill: string): void {
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
}

function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  c.fillStyle = fill;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}

const BAND = [
  ['#86b96b', '#7db263', '#8dbf72'],
  ['#6aa35c', '#629b55', '#71a962'],
  ['#a9b97c', '#a1b174', '#b1c084'],
  ['#bdb7a8', '#b4ae9f', '#c5c0b2'],
];

/** 미니맵에서 쓰는 타일별 대표색. */
export function tileColor(t: number): string {
  if (t < 12) return BAND[Math.floor(t / 3)][1];
  if (t < 16) return BAND[t - 12][1];
  if (t === T.TRAIL || t === T.TRAIL2) return '#f1dfb4';
  if (t === T.YARD) return '#d4dca6';
  if (t === T.WATER || t === T.WATER2) return '#72b8d8';
  if (t === T.BRIDGE) return '#a9793f';
  return '#b79266';
}

function speckle(c: Ctx, seed: number, n: number): void {
  const r = rnd(seed);
  for (let i = 0; i < n; i++) {
    c.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.09)';
    c.fillRect(Math.floor(r() * 29), Math.floor(r() * 29), 2 + Math.floor(r() * 2), 2);
  }
}

function drawTile(c: Ctx, i: number): void {
  if (i < 12) {
    c.fillStyle = BAND[Math.floor(i / 3)][i % 3];
    c.fillRect(0, 0, 32, 32);
    speckle(c, 100 + i, 7);
    return;
  }
  if (i < 16) {
    c.fillStyle = BAND[i - 12][1];
    c.fillRect(0, 0, 32, 32);
    speckle(c, 200 + i, 4);
    c.fillStyle = '#8f8472';
    c.fillRect(0, 20, 32, 12);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(0, 20, 32, 2);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(0, 29, 32, 3);
    c.fillRect(9, 23, 1, 6);
    c.fillRect(22, 22, 1, 7);
    return;
  }
  switch (i) {
    case T.TRAIL:
    case T.TRAIL2: {
      c.fillStyle = i === T.TRAIL ? '#e2cda3' : '#dcc699';
      c.fillRect(0, 0, 32, 32);
      const r = rnd(300 + i);
      for (let k = 0; k < 5; k++) {
        ellipse(c, 3 + r() * 26, 3 + r() * 26, 1.5 + r(), 1 + r() * 0.8, r() < 0.5 ? '#c9b188' : '#efdfbb');
      }
      return;
    }
    case T.YARD:
      c.fillStyle = '#c5d595';
      c.fillRect(0, 0, 32, 32);
      speckle(c, 400, 5);
      return;
    case T.WATER:
    case T.WATER2: {
      c.fillStyle = '#72b8d8';
      c.fillRect(0, 0, 32, 32);
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 1.5;
      const o = i === T.WATER ? 0 : 9;
      for (const y of [7 + o, 22 - o / 2]) {
        c.beginPath();
        c.moveTo(6 + o, y);
        c.quadraticCurveTo(11 + o, y - 3, 16 + o, y);
        c.stroke();
      }
      return;
    }
    case T.BRIDGE:
      c.fillStyle = '#b5834a';
      c.fillRect(0, 0, 32, 32);
      c.fillStyle = '#8f6233';
      for (let y = 7; y < 32; y += 8) c.fillRect(0, y, 32, 1);
      c.fillStyle = 'rgba(255,255,255,0.15)';
      for (let y = 0; y < 32; y += 8) c.fillRect(0, y, 32, 1);
      return;
    case T.SOIL:
      c.fillStyle = '#c2a074';
      c.fillRect(0, 0, 32, 32);
      speckle(c, 500, 5);
      return;
    case T.PLOT:
      c.fillStyle = '#c2a074';
      c.fillRect(0, 0, 32, 32);
      rrect(c, 1, 1, 30, 30, 5, '#7b5738');
      c.fillStyle = '#684829';
      for (const y of [8, 16, 24]) c.fillRect(4, y, 24, 2);
      c.fillStyle = 'rgba(255,255,255,0.1)';
      for (const y of [6, 14, 22]) c.fillRect(4, y, 24, 1);
      return;
    case T.TREE_A:
    case T.TREE_B: {
      const a = i === T.TREE_A;
      ellipse(c, 16, 28, 10, 3.5, 'rgba(0,0,0,0.18)');
      c.fillStyle = '#7a5a3a';
      c.fillRect(14, 18, 4, 10);
      circle(c, 16, 13, a ? 11.5 : 10, a ? '#4f9a4a' : '#5aa856');
      circle(c, a ? 10 : 21, 16, 6, a ? '#488f44' : '#51a04e');
      circle(c, 13, 9, 5, a ? '#66b25e' : '#74bf69');
      return;
    }
    case T.PINE_A:
    case T.PINE_B: {
      const a = i === T.PINE_A;
      ellipse(c, 16, 29, 9, 3, 'rgba(0,0,0,0.18)');
      c.fillStyle = '#6b4c30';
      c.fillRect(15, 23, 3, 6);
      const col = a ? '#3b7a4c' : '#2f6b43';
      poly(c, [16, 12, 4, 26, 28, 26], col);
      poly(c, [16, 6, 7, 19, 25, 19], a ? '#438856' : '#37784c');
      poly(c, [16, 1, 10, 12, 22, 12], a ? '#4c9460' : '#408555');
      return;
    }
    case T.BUSH:
      ellipse(c, 16, 26, 10, 3, 'rgba(0,0,0,0.15)');
      circle(c, 12, 20, 6.5, '#5ea457');
      circle(c, 20, 19, 7.5, '#69b060');
      circle(c, 18, 16, 3, '#84c477');
      return;
    case T.ROCK:
      ellipse(c, 16, 26, 10, 3, 'rgba(0,0,0,0.15)');
      poly(c, [6, 25, 9, 14, 17, 10, 25, 15, 27, 25], '#9a958a');
      poly(c, [9, 14, 17, 10, 19, 16, 12, 18], '#b6b1a6');
      return;
    case T.FLOWER:
      for (const [x, y, col] of [
        [9, 12, '#f6d55c'],
        [20, 9, '#f2a7c3'],
        [15, 22, '#ffffff'],
        [24, 21, '#f6d55c'],
      ] as const) {
        c.fillStyle = '#5a9a50';
        c.fillRect(x, y + 1, 1, 4);
        circle(c, x + 0.5, y, 2.2, col);
        circle(c, x + 0.5, y, 0.9, '#e09b3d');
      }
      return;
    case T.STUMP:
      ellipse(c, 16, 25, 9, 3.5, 'rgba(0,0,0,0.18)');
      c.fillStyle = '#7a5a3a';
      c.fillRect(10, 17, 12, 8);
      ellipse(c, 16, 25, 6, 2.2, '#7a5a3a');
      ellipse(c, 16, 17, 6, 3, '#d9b27c');
      ellipse(c, 16, 17, 3.2, 1.5, '#c39a62');
      return;
    case T.RUBBLE:
      ellipse(c, 16, 25, 9, 3, 'rgba(0,0,0,0.12)');
      ellipse(c, 11, 23, 3.5, 2.5, '#9a958a');
      ellipse(c, 19, 24, 4, 2.6, '#aaa59a');
      ellipse(c, 15, 20, 2.5, 1.8, '#b6b1a6');
      return;
    case T.PEN: {
      c.fillStyle = '#d6c08d';
      c.fillRect(0, 0, 32, 32);
      const r = rnd(900);
      for (let k = 0; k < 9; k++) {
        c.fillStyle = r() < 0.5 ? '#e9dcae' : '#c4ad78';
        c.fillRect(Math.floor(r() * 28), Math.floor(r() * 30), 4, 1);
      }
      return;
    }
    case T.REED: {
      const r = rnd(777);
      c.lineWidth = 1.5;
      for (let k = 0; k < 9; k++) {
        const x = 5 + r() * 22;
        const lean = (r() - 0.5) * 8;
        c.strokeStyle = r() < 0.5 ? '#e9dcae' : '#d6c68f';
        c.beginPath();
        c.moveTo(x, 29);
        c.quadraticCurveTo(x, 18, x + lean, 8 + r() * 6);
        c.stroke();
      }
      return;
    }
  }
}

function buildTileset(): HTMLCanvasElement {
  // 타일 사이에 1px 여백을 두고 가장자리 색을 번지게 해, 확대·축소 때 틈이 보이지 않게 한다.
  const cell = TILE + 2;
  const [atlas, a] = mk(cell * TILE_COUNT, cell);
  for (let i = 0; i < TILE_COUNT; i++) {
    const [tc, t] = mk(TILE, TILE);
    drawTile(t, i);
    if (i < T.TREE_A || i === T.PEN) a.drawImage(tc, i * cell, 0, cell, cell);
    a.drawImage(tc, i * cell + 1, 1);
  }
  return atlas;
}

function drawPlayer(sit: boolean): HTMLCanvasElement {
  const [cv, c] = mk(32, 40);
  const by = sit ? 6 : 0;
  if (!sit) {
    c.fillStyle = '#4a4034';
    c.fillRect(11, 31, 4, 7);
    c.fillRect(17, 31, 4, 7);
  } else {
    rrect(c, 8, 33, 16, 5, 2, '#4a4034');
  }
  rrect(c, 7, 17 + by, 5, 12, 2, '#5d7a52'); // 배낭
  rrect(c, 9, 16 + by, 14, 16, 5, '#e07a3f'); // 윗옷
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.fillRect(15, 18 + by, 2, 12);
  circle(c, 16, 11 + by, 7, '#f4d6b4'); // 얼굴
  c.fillStyle = '#3b2f22';
  c.fillRect(13, 11 + by, 2, 2);
  c.fillRect(18, 11 + by, 2, 2);
  ellipse(c, 16, 7 + by, 11, 3.2, '#e8d28a'); // 밀짚모자 챙
  rrect(c, 10, 1 + by, 12, 7, 4, '#f0dc98');
  c.fillStyle = '#b5544a';
  c.fillRect(10, 5 + by, 12, 2);
  return cv;
}

function drawPension(): HTMLCanvasElement {
  const [cv, c] = mk(256, 208);
  ellipse(c, 128, 200, 122, 8, 'rgba(0,0,0,0.15)');
  // 굴뚝
  c.fillStyle = '#8d8577';
  c.fillRect(178, 8, 24, 40);
  c.fillStyle = '#6f685c';
  c.fillRect(175, 6, 30, 7);
  // 벽
  c.fillStyle = '#efe2c4';
  c.fillRect(18, 108, 220, 92);
  c.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 120; y < 200; y += 12) c.fillRect(18, y, 220, 1);
  c.fillStyle = '#8a6a48';
  c.fillRect(18, 194, 220, 6);
  // 지붕
  poly(c, [2, 114, 42, 28, 214, 28, 254, 114], '#a8503c');
  c.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 44; y < 112; y += 16) c.fillRect(0, y, 256, 2);
  poly(c, [2, 114, 254, 114, 250, 122, 6, 122], '#8a3f2f');
  c.fillStyle = '#c96a52';
  c.fillRect(42, 26, 172, 5);
  // 문
  rrect(c, 112, 148, 32, 52, 3, '#5b3d22');
  rrect(c, 115, 151, 26, 49, 2, '#7a4f2c');
  circle(c, 136, 178, 2, '#e8c96a');
  // 창문
  for (const x of [40, 172]) {
    rrect(c, x, 138, 44, 34, 3, '#ffffff');
    c.fillStyle = '#ffe7a3';
    c.fillRect(x + 4, 142, 36, 26);
    c.fillStyle = '#ffffff';
    c.fillRect(x + 21, 142, 2, 26);
    c.fillRect(x + 4, 154, 36, 2);
    c.fillStyle = '#8a6a48';
    c.fillRect(x - 2, 172, 48, 4);
  }
  // 간판
  rrect(c, 104, 124, 48, 18, 3, '#5b3d22');
  c.fillStyle = '#fff6dc';
  c.font = 'bold 12px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('펜션', 128, 134);
  return cv;
}

function drawSign(): HTMLCanvasElement {
  const [cv, c] = mk(28, 32);
  c.fillStyle = '#7a5a3a';
  c.fillRect(12, 12, 4, 20);
  rrect(c, 1, 2, 26, 13, 2, '#9c7448');
  c.fillStyle = '#f3e3bd';
  c.fillRect(5, 6, 18, 2);
  c.fillRect(5, 10, 12, 2);
  return cv;
}

function drawFeature(kind: string): HTMLCanvasElement {
  switch (kind) {
    case 'gate': {
      const [cv, c] = mk(96, 64);
      c.fillStyle = '#7a5a3a';
      c.fillRect(8, 14, 7, 50);
      c.fillRect(81, 14, 7, 50);
      rrect(c, 0, 6, 96, 12, 3, '#9c7448');
      rrect(c, 12, 20, 72, 6, 2, '#8a6640');
      c.fillStyle = '#f3e3bd';
      c.font = 'bold 9px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('등 산 로', 48, 12.5);
      return cv;
    }
    case 'spring': {
      const [cv, c] = mk(44, 36);
      ellipse(c, 22, 31, 20, 4, 'rgba(0,0,0,0.15)');
      poly(c, [4, 30, 8, 12, 22, 6, 36, 12, 40, 30], '#9a958a');
      poly(c, [8, 12, 22, 6, 30, 12, 14, 16], '#b6b1a6');
      ellipse(c, 22, 24, 12, 5, '#72b8d8');
      ellipse(c, 19, 23, 5, 1.5, 'rgba(255,255,255,0.6)');
      c.fillStyle = '#72b8d8';
      c.fillRect(21, 12, 2, 10);
      return cv;
    }
    case 'bench': {
      const [cv, c] = mk(48, 26);
      ellipse(c, 24, 23, 22, 3, 'rgba(0,0,0,0.15)');
      c.fillStyle = '#6b4c30';
      c.fillRect(6, 12, 5, 11);
      c.fillRect(37, 12, 5, 11);
      rrect(c, 1, 5, 46, 10, 5, '#a9793f');
      ellipse(c, 5, 10, 3.5, 4.5, '#d9b27c');
      c.fillStyle = 'rgba(255,255,255,0.2)';
      c.fillRect(8, 7, 34, 2);
      return cv;
    }
    case 'deck': {
      const [cv, c] = mk(80, 52);
      ellipse(c, 40, 48, 36, 4, 'rgba(0,0,0,0.15)');
      c.fillStyle = '#b5834a';
      c.fillRect(4, 22, 72, 24);
      c.fillStyle = '#8f6233';
      for (let x = 12; x < 76; x += 9) c.fillRect(x, 22, 1, 24);
      c.fillStyle = '#7a5a3a';
      for (let x = 4; x <= 72; x += 17) c.fillRect(x, 6, 4, 18);
      c.fillRect(4, 6, 72, 4);
      c.fillRect(4, 14, 72, 3);
      return cv;
    }
    default: {
      const [cv, c] = mk(32, 50);
      ellipse(c, 16, 46, 13, 3.5, 'rgba(0,0,0,0.18)');
      rrect(c, 4, 38, 24, 8, 2, '#8d8577');
      rrect(c, 8, 2, 16, 38, 5, '#c9c4b8');
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillRect(10, 5, 3, 30);
      c.fillStyle = '#4a4034';
      c.font = 'bold 11px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('정', 16, 14);
      c.fillText('상', 16, 28);
      return cv;
    }
  }
}

function drawCrop(crop: CropId, stage: number): HTMLCanvasElement {
  const [cv, c] = mk(32, 32);
  const leaf = (x: number, y: number, rx: number, ry: number, rot: number, col: string) => {
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    c.fill();
  };
  if (stage === 0) {
    for (const x of [9, 16, 23]) {
      ellipse(c, x, 18, 3.5, 2.2, '#5d3f25');
      circle(c, x, 17, 1, '#e9dcae');
    }
    return cv;
  }
  if (stage === 1) {
    for (const x of [9, 16, 23]) {
      c.fillStyle = '#6fae54';
      c.fillRect(x - 0.5, 14, 1.5, 6);
      leaf(x - 2.5, 13, 3, 1.6, -0.6, '#7cc262');
      leaf(x + 2.5, 13, 3, 1.6, 0.6, '#7cc262');
    }
    return cv;
  }
  const big = stage === 3;
  if (crop === 'lettuce') {
    for (const x of [9, 16, 23]) {
      const r = big ? 5.5 : 3.8;
      circle(c, x, 17, r, '#7cc262');
      circle(c, x - 1, 16, r * 0.6, '#a5dc86');
      if (big) circle(c, x, 16, 1.8, '#d5f0b6');
    }
  } else if (crop === 'carrot') {
    for (const x of [9, 16, 23]) {
      for (const d of [-3, 0, 3]) {
        c.strokeStyle = '#5fae54';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(x, 20);
        c.quadraticCurveTo(x + d * 0.4, 14, x + d, big ? 6 : 10);
        c.stroke();
      }
      if (big) {
        ellipse(c, x, 21, 3.2, 2.4, '#f08a3c');
        c.fillStyle = '#c96a24';
        c.fillRect(x - 2, 21, 4, 1);
      }
    }
  } else {
    for (const x of [10, 22]) {
      c.fillStyle = '#8a6a48';
      c.fillRect(x - 0.5, 4, 1.5, 22);
      circle(c, x, 14, big ? 7 : 5, '#5a9f50');
      circle(c, x - 2, 11, big ? 4 : 3, '#72b765');
      if (big) {
        circle(c, x - 3, 17, 2.6, '#e2473b');
        circle(c, x + 3, 13, 2.6, '#e2473b');
        circle(c, x + 1, 20, 2.3, '#ef6a4f');
      }
    }
  }
  return cv;
}

/** 실내 지도 크기(칸). 펜션은 왼쪽이 거실, 오른쪽 4칸이 주방. */
export const ROOM_W = 16;
export const ROOM_H = 9;
export const CAFE_W = 14;
export const CAFE_H = 10;

function drawRoom(): HTMLCanvasElement {
  const [cv, c] = mk(ROOM_W * TILE, ROOM_H * TILE);
  const W = ROOM_W * TILE;
  const H = ROOM_H * TILE;
  // 바닥
  c.fillStyle = '#c99c66';
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 64; y < H; y += 16) c.fillRect(0, y, W, 1);
  for (let y = 64, k = 0; y < H; y += 16, k++) for (let x = k % 2 ? 40 : 88; x < W; x += 96) c.fillRect(x, y, 1, 16);
  // 러그
  ellipse(c, 6 * TILE, 5.5 * TILE, 78, 44, '#b5544a');
  ellipse(c, 6 * TILE, 5.5 * TILE, 66, 34, '#c96a52');
  ellipse(c, 6 * TILE, 5.5 * TILE, 30, 14, '#e2a47f');
  // 주방 바닥(오른쪽 4칸): 타일 무늬
  for (let y = 64, r = 0; y < H - 32; y += 16, r++)
    for (let x = 352, k = 0; x < W - 32; x += 16, k++) {
      c.fillStyle = (r + k) % 2 ? '#e9e2d0' : '#d8cfb8';
      c.fillRect(x, y, 16, 16);
    }
  c.fillStyle = 'rgba(0,0,0,0.12)';
  c.fillRect(350, 64, 2, H - 96);
  // 위쪽 벽
  c.fillStyle = '#efe2c4';
  c.fillRect(0, 0, W, 64);
  c.fillStyle = '#8a6a48';
  c.fillRect(0, 58, W, 6);
  // 옆·아래 벽
  c.fillStyle = '#7d5f41';
  c.fillRect(0, 0, 32, H);
  c.fillRect(W - 32, 0, 32, H);
  c.fillRect(0, H - 32, W, 32);
  c.fillStyle = 'rgba(0,0,0,0.15)';
  c.fillRect(28, 0, 4, H - 32);
  c.fillRect(W - 32, 0, 4, H - 32);
  c.fillRect(32, H - 32, W - 64, 4);
  // 문(아래쪽 가운데)
  c.fillStyle = '#c99c66';
  c.fillRect(6 * TILE, H - 32, 32, 32);
  rrect(c, 6 * TILE + 3, H - 26, 26, 18, 3, '#6f8f5a');
  c.fillStyle = '#f3e3bd';
  c.font = 'bold 9px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('나가기', 6 * TILE + 16, H - 16.5);
  // 창문
  rrect(c, 258, 8, 76, 42, 3, '#ffffff');
  c.fillStyle = '#a9d6ee';
  c.fillRect(262, 12, 68, 34);
  poly(c, [262, 46, 284, 24, 300, 38, 314, 28, 330, 46], '#6aa35c');
  c.fillStyle = '#ffffff';
  c.fillRect(295, 12, 2, 34);
  // 벽난로
  rrect(c, 136, 14, 64, 50, 4, '#8d8577');
  rrect(c, 148, 30, 40, 34, 3, '#3b2f22');
  rrect(c, 155, 57, 26, 5, 2, '#6b4c30');
  rrect(c, 160, 53, 16, 5, 2, '#7a5a3a');
  c.fillStyle = '#6f685c';
  c.fillRect(132, 10, 72, 7);
  // 액자
  rrect(c, 60, 14, 36, 28, 2, '#8a6a48');
  c.fillStyle = '#dfeccb';
  c.fillRect(64, 18, 28, 20);
  poly(c, [64, 38, 76, 24, 84, 32, 92, 38], '#86b96b');
  // 주방: 선반, 조리대, 화덕, 개수대
  c.fillStyle = '#8a6a48';
  c.fillRect(362, 24, 108, 4);
  for (const [x, col] of [[368, '#e2473b'], [382, '#f6d55c'], [396, '#7cc262'], [440, '#c9643f'], [454, '#f3e3bd']] as const) {
    rrect(c, x, 12, 9, 12, 2, col);
    c.fillStyle = '#5b3d22';
    c.fillRect(x + 1, 10, 7, 3);
  }
  for (const x of [414, 426]) {
    c.fillStyle = '#6f685c';
    c.fillRect(x, 28, 2, 8);
    circle(c, x + 1, 42, 6, '#4a4a4a');
  }
  rrect(c, 352, 66, 128, 30, 3, '#8a6a48'); // 조리대 몸통
  c.fillStyle = 'rgba(0,0,0,0.15)';
  for (const x of [384, 416, 448]) c.fillRect(x, 78, 1, 18);
  rrect(c, 350, 56, 132, 16, 3, '#e3c99a'); // 상판
  rrect(c, 357, 59, 22, 10, 2, '#f0dc98'); // 도마
  circle(c, 364, 64, 2.5, '#f08a3c');
  circle(c, 371, 64, 2.5, '#7cc262');
  rrect(c, 386, 58, 28, 12, 2, '#3b3b3b'); // 화덕
  ellipse(c, 400, 62, 10, 5, '#8f969e');
  ellipse(c, 400, 61, 7, 3, '#c96a52');
  c.fillStyle = '#8f969e';
  c.fillRect(411, 61, 6, 2);
  rrect(c, 420, 59, 24, 10, 3, '#b9c4cc'); // 개수대
  rrect(c, 423, 61, 18, 6, 2, '#8fb6cc');
  c.fillStyle = '#8f969e';
  c.fillRect(431, 53, 2, 8);
  ellipse(c, 464, 63, 10, 5, '#c39a62'); // 바구니
  circle(c, 460, 61, 3, '#e2473b');
  circle(c, 466, 60, 3, '#7cc262');
  circle(c, 469, 63, 2.5, '#f08a3c');
  // 침대
  rrect(c, 34, 62, 64, 68, 5, '#7a5a3a');
  rrect(c, 38, 66, 56, 60, 4, '#f7f1e3');
  rrect(c, 38, 88, 56, 38, 4, '#7fa6c9');
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.fillRect(38, 88, 56, 4);
  rrect(c, 46, 69, 40, 15, 6, '#ffffff');
  // 탁자와 찻잔
  ellipse(c, 9 * TILE, 4 * TILE + 2, 30, 5, 'rgba(0,0,0,0.15)');
  rrect(c, 8 * TILE + 2, 3 * TILE + 2, 60, 26, 5, '#a9793f');
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(8 * TILE + 6, 3 * TILE + 5, 52, 3);
  circle(c, 9 * TILE - 8, 3 * TILE + 15, 5, '#ffffff');
  circle(c, 9 * TILE - 8, 3 * TILE + 15, 3, '#b98a4a');
  circle(c, 9 * TILE + 12, 3 * TILE + 16, 5, '#ffffff');
  circle(c, 9 * TILE + 12, 3 * TILE + 16, 3, '#b98a4a');
  // 방석
  ellipse(c, 8.5 * TILE, 5.5 * TILE + 3, 13, 9, 'rgba(0,0,0,0.15)');
  ellipse(c, 8.5 * TILE, 5.5 * TILE, 13, 10, '#5d7a9a');
  ellipse(c, 8.5 * TILE, 5.5 * TILE - 1, 8, 5.5, '#7b98b8');
  return cv;
}

/** 산에서 보이는 카페 건물. */
function drawCafe(): HTMLCanvasElement {
  const [cv, c] = mk(256, 176);
  ellipse(c, 128, 168, 120, 7, 'rgba(0,0,0,0.15)');
  c.fillStyle = '#f3ead7';
  c.fillRect(20, 56, 216, 112);
  c.fillStyle = '#8a6a48';
  c.fillRect(20, 162, 216, 6);
  // 평지붕과 차양
  rrect(c, 10, 34, 236, 26, 4, '#3f6b52');
  c.fillStyle = 'rgba(255,255,255,0.14)';
  c.fillRect(10, 34, 236, 5);
  for (let x = 14, k = 0; x < 242; x += 19, k++) {
    poly(c, [x, 60, x + 19, 60, x + 19, 76, x + 9.5, 82, x, 76], k % 2 ? '#f3ead7' : '#4f8566');
  }
  // 간판
  rrect(c, 92, 6, 72, 26, 5, '#5b3d22');
  c.fillStyle = '#fff6dc';
  c.font = 'bold 15px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('카 페', 128, 20);
  // 큰 창
  for (const x of [32, 164]) {
    rrect(c, x, 94, 60, 50, 3, '#5b3d22');
    c.fillStyle = '#ffe7a3';
    c.fillRect(x + 4, 98, 52, 42);
    c.fillStyle = '#5b3d22';
    c.fillRect(x + 29, 98, 2, 42);
    circle(c, x + 16, 126, 5, '#c9643f');
    circle(c, x + 43, 126, 5, '#7b98b8');
  }
  // 문
  rrect(c, 110, 100, 36, 68, 3, '#5b3d22');
  rrect(c, 114, 104, 28, 64, 2, '#7a9a82');
  c.fillStyle = '#d5efe0';
  c.fillRect(118, 108, 20, 26);
  circle(c, 137, 142, 2, '#e8c96a');
  // 화분
  for (const x of [100, 156]) {
    rrect(c, x - 6, 154, 12, 12, 2, '#c9643f');
    circle(c, x, 148, 8, '#5ea457');
    circle(c, x - 3, 145, 4, '#84c477');
  }
  return cv;
}

/** 카페 실내. */
function drawCafeRoom(): HTMLCanvasElement {
  const W = CAFE_W * TILE;
  const H = CAFE_H * TILE;
  const [cv, c] = mk(W, H);
  // 바닥
  c.fillStyle = '#dcc097';
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(0,0,0,0.07)';
  for (let x = 32; x < W - 32; x += 24) c.fillRect(x, 64, 1, H - 96);
  for (let x = 32, k = 0; x < W - 32; x += 24, k++) for (let y = k % 2 ? 84 : 116; y < H - 32; y += 64) c.fillRect(x, y, 24, 1);
  // 위쪽 벽과 큰 창
  c.fillStyle = '#f3ead7';
  c.fillRect(0, 0, W, 64);
  c.fillStyle = '#6f5a45';
  c.fillRect(0, 58, W, 6);
  rrect(c, 172, 6, 236, 46, 3, '#5b3d22');
  c.fillStyle = '#bfe0f2';
  c.fillRect(176, 10, 228, 38);
  poly(c, [176, 48, 216, 20, 248, 40, 290, 14, 340, 42, 372, 26, 404, 48], '#7db263');
  poly(c, [276, 23, 290, 14, 304, 22, 296, 24, 289, 20, 283, 24], '#ffffff');
  c.fillStyle = '#5b3d22';
  for (const x of [232, 289, 346]) c.fillRect(x, 10, 3, 38);
  // 창가 긴 탁자와 의자
  rrect(c, 172, 60, 236, 12, 3, '#a9793f');
  c.fillStyle = 'rgba(255,255,255,0.2)';
  c.fillRect(176, 62, 228, 2);
  for (const col of [6, 8, 10, 12]) {
    ellipse(c, (col + 0.5) * TILE, 2.5 * TILE + 6, 11, 5, 'rgba(0,0,0,0.15)');
    circle(c, (col + 0.5) * TILE, 2.5 * TILE + 2, 10, '#7a5a3a');
    circle(c, (col + 0.5) * TILE, 2.5 * TILE, 10, '#c39a62');
  }
  // 옆·아래 벽
  c.fillStyle = '#6f5a45';
  c.fillRect(0, 0, 32, H);
  c.fillRect(W - 32, 0, 32, H);
  c.fillRect(0, H - 32, W, 32);
  c.fillStyle = 'rgba(0,0,0,0.15)';
  c.fillRect(28, 0, 4, H - 32);
  c.fillRect(W - 32, 0, 4, H - 32);
  c.fillRect(32, H - 32, W - 64, 4);
  // 문
  c.fillStyle = '#dcc097';
  c.fillRect(7 * TILE, H - 32, 32, 32);
  rrect(c, 7 * TILE + 3, H - 26, 26, 18, 3, '#3f6b52');
  c.fillStyle = '#f3e3bd';
  c.font = 'bold 9px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('나가기', 7 * TILE + 16, H - 16.5);
  // 차림표
  rrect(c, 44, 8, 76, 34, 3, '#2f4a3a');
  c.fillStyle = '#f3ead7';
  c.font = 'bold 10px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  c.fillText('차 림 표', 82, 17);
  c.fillStyle = 'rgba(243,234,215,0.7)';
  for (const y of [25, 30, 35]) c.fillRect(54, y, 56, 1.5);
  // 주인: 계산대 뒤에 서 있다
  rrect(c, 124, 40, 16, 22, 5, '#f3ead7');
  rrect(c, 126, 46, 12, 16, 2, '#3f6b52');
  circle(c, 132, 34, 7, '#f4d6b4');
  c.fillStyle = '#3b2f22';
  c.fillRect(129, 33, 2, 2);
  c.fillRect(134, 33, 2, 2);
  poly(c, [124, 31, 132, 23, 140, 31, 138, 28, 126, 28], '#5b3d22');
  // 계산대
  rrect(c, 32, 68, 128, 28, 3, '#5b3d22');
  rrect(c, 30, 56, 132, 18, 3, '#c39a62');
  c.fillStyle = 'rgba(255,255,255,0.2)';
  c.fillRect(34, 58, 124, 2);
  rrect(c, 40, 44, 30, 22, 3, '#8f969e'); // 커피 기계
  rrect(c, 44, 48, 22, 8, 2, '#4a4a4a');
  circle(c, 49, 61, 2, '#e2473b');
  circle(c, 61, 61, 2, '#f6d55c');
  ellipse(c, 96, 62, 13, 4, '#ffffff'); // 케이크 받침
  poly(c, [86, 60, 106, 60, 104, 50, 88, 50], '#f2a7c3');
  c.fillStyle = '#ffffff';
  c.fillRect(88, 49, 16, 3);
  circle(c, 96, 47, 2.5, '#e2473b');
  // 둥근 탁자 2개와 의자
  for (const col of [5, 10]) {
    const x = (col + 0.5) * TILE;
    const y = 5.5 * TILE;
    for (const dx of [-32, 32]) {
      ellipse(c, x + dx, y + 6, 11, 5, 'rgba(0,0,0,0.15)');
      circle(c, x + dx, y + 2, 10, '#7a5a3a');
      circle(c, x + dx, y, 10, '#c39a62');
    }
    ellipse(c, x, y + 8, 17, 6, 'rgba(0,0,0,0.18)');
    circle(c, x, y, 16, '#8a6640');
    circle(c, x, y - 2, 15, '#f3ead7');
    circle(c, x, y - 2, 4, '#7cc262');
    circle(c, x + 1, y - 4, 2, '#f2a7c3');
  }
  // 화분
  rrect(c, 12 * TILE + 6, 7 * TILE + 12, 20, 18, 3, '#c9643f');
  circle(c, 12.5 * TILE, 7 * TILE + 6, 13, '#5ea457');
  circle(c, 12.5 * TILE - 5, 7 * TILE, 7, '#84c477');
  circle(c, 12.5 * TILE + 6, 7 * TILE + 2, 6, '#4f9a4a');
  return cv;
}

export function buildTextures(scene: Phaser.Scene): void {
  const tx = scene.textures;
  if (tx.exists('tiles')) return;
  tx.addCanvas('tiles', buildTileset());
  tx.addCanvas('player', drawPlayer(false));
  tx.addCanvas('player_sit', drawPlayer(true));
  tx.addCanvas('pension', drawPension());
  tx.addCanvas('sign', drawSign());
  for (const k of ['gate', 'spring', 'bench', 'deck', 'stone']) tx.addCanvas('f_' + k, drawFeature(k));
  for (const id of CROP_IDS) for (let s = 0; s < 4; s++) tx.addCanvas(`crop_${id}_${s}`, drawCrop(id, s));
  tx.addCanvas('room', drawRoom());
  tx.addCanvas('cafe', drawCafe());
  tx.addCanvas('caferoom', drawCafeRoom());
  const [fc, f] = mk(28, 26);
  poly(f, [3, 26, 14, 1, 25, 26], '#f08a3c');
  poly(f, [9, 26, 14, 11, 19, 26], '#f6d55c');
  tx.addCanvas('fire', fc);
  const [gc, g] = mk(240, 240);
  const grad = g.createRadialGradient(120, 120, 0, 120, 120, 120);
  grad.addColorStop(0, 'rgba(255,170,80,0.55)');
  grad.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 240, 240);
  tx.addCanvas('glow', gc);
  const [ac, a] = mk(18, 24);
  a.fillStyle = '#8a6a48';
  a.fillRect(8, 4, 3, 20);
  poly(a, [3, 2, 14, 2, 16, 10, 5, 10], '#b9bfc6');
  poly(a, [3, 2, 14, 2, 14.5, 4, 3.5, 4], '#e3e7ea');
  tx.addCanvas('axe', ac);
  const [pc, p] = mk(22, 24);
  p.fillStyle = '#8a6a48';
  p.fillRect(10, 4, 3, 20);
  p.strokeStyle = '#8f969e';
  p.lineWidth = 3.5;
  p.lineCap = 'round';
  p.beginPath();
  p.moveTo(2, 9);
  p.quadraticCurveTo(11, -1, 20, 9);
  p.stroke();
  tx.addCanvas('pick', pc);
  // 우리 울타리: 뒤쪽(위·양옆)과 앞쪽(아래)을 따로 그려 동물이 그 사이에 보이게 한다.
  const pw = (PEN.x1 - PEN.x0 + 1) * TILE;
  const ph = (PEN.y1 - PEN.y0 + 1) * TILE;
  const rail = (k: Ctx, y: number) => {
    k.fillStyle = '#b98a54';
    k.fillRect(2, y + 5, pw + 8, 3);
    k.fillRect(2, y + 11, pw + 8, 3);
    for (let x = 4; x <= pw + 6; x += TILE) {
      rrect(k, x - 1, y, 6, 19, 2, '#8a6640');
      k.fillStyle = 'rgba(255,255,255,0.22)';
      k.fillRect(x, y + 1, 1.5, 16);
    }
  };
  const [bk, bkc] = mk(pw + 12, ph + 22);
  for (const x of [5, pw + 5]) {
    bkc.fillStyle = '#b98a54';
    bkc.fillRect(x, 16, 3, ph - 12);
    for (let y = 18 + TILE; y < ph; y += TILE) rrect(bkc, x - 1.5, y - 6, 6, 12, 2, '#8a6640');
  }
  rail(bkc, 0);
  tx.addCanvas('pen_back', bk);
  const [fr, frc] = mk(pw + 12, 24);
  rail(frc, 2);
  tx.addCanvas('pen_front', fr);
  // 닭(흰색·갈색)
  for (const [key, bodyCol, wingCol] of [['chicken_w', '#fbf7ee', '#e6dfd0'], ['chicken_b', '#c98f58', '#a8733f']] as const) {
    const [cc, k] = mk(24, 24);
    k.fillStyle = '#e8a23c';
    k.fillRect(9, 19, 1.5, 4);
    k.fillRect(13, 19, 1.5, 4);
    poly(k, [3, 12, 8, 9, 8, 16], wingCol); // 꼬리깃
    ellipse(k, 11, 15, 7, 5.5, bodyCol);
    ellipse(k, 10, 15.5, 4, 3, wingCol);
    circle(k, 17, 9, 4.2, bodyCol);
    poly(k, [15, 5, 16.5, 2.5, 18, 5, 19.5, 3, 20, 6], '#e2473b'); // 볏
    poly(k, [20.5, 9, 23.5, 10, 20.5, 11.5], '#f0b23c'); // 부리
    circle(k, 18.5, 12.5, 1.3, '#e2473b');
    k.fillStyle = '#2a2018';
    k.fillRect(17.5, 8, 1.6, 1.6);
    tx.addCanvas(key, cc);
  }
  // 토끼(흰색·갈색·회색)
  for (const [key, col, shade] of [['rabbit_w', '#fbf7f2', '#e4dbd0'], ['rabbit_b', '#b98a5e', '#9a6f47'], ['rabbit_g', '#b4b0aa', '#96928c']] as const) {
    const [cc, k] = mk(26, 26);
    ellipse(k, 11, 19, 8, 5.5, col);
    circle(k, 4, 18, 2.6, '#ffffff'); // 꼬리
    ellipse(k, 9, 20.5, 4, 2.6, shade);
    k.save();
    k.translate(17, 8);
    k.rotate(-0.25);
    ellipse(k, 0, -3, 1.8, 6, col);
    ellipse(k, 0, -3, 0.8, 4, '#f2b8c0');
    k.restore();
    k.save();
    k.translate(20, 8);
    k.rotate(0.2);
    ellipse(k, 0, -3, 1.8, 6, col);
    ellipse(k, 0, -3, 0.8, 4, '#f2b8c0');
    k.restore();
    circle(k, 18.5, 13.5, 4.8, col);
    circle(k, 23, 14.5, 1, '#e58f9c');
    k.fillStyle = '#2a2018';
    k.fillRect(19.5, 12, 1.7, 1.7);
    k.fillStyle = shade;
    k.fillRect(14, 23, 4, 2);
    k.fillRect(7, 23, 5, 2);
    tx.addCanvas(key, cc);
  }
  const [cb, cbc] = mk(14, 12);
  poly(cbc, [1, 7, 10, 4, 10, 10], '#f08a3c');
  poly(cbc, [9, 5, 13, 1, 12, 6, 13, 10, 9, 9], '#5fae54');
  tx.addCanvas('carrot_bit', cb);
  const [sh, s] = mk(28, 12);
  ellipse(s, 14, 6, 13, 5, 'rgba(0,0,0,0.22)');
  tx.addCanvas('shadow', sh);
}
