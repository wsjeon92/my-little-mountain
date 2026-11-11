import type Phaser from 'phaser';
import { T, TILE, TILE_COUNT } from './mapgen';
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
    if (i < T.TREE_A) a.drawImage(tc, i * cell, 0, cell, cell);
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

export const ROOM_W = 12;
export const ROOM_H = 9;

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
  poly(c, [158, 62, 168, 40, 178, 62], '#f08a3c');
  poly(c, [163, 62, 168, 50, 173, 62], '#f6d55c');
  c.fillStyle = '#6f685c';
  c.fillRect(132, 10, 72, 7);
  // 액자
  rrect(c, 60, 14, 36, 28, 2, '#8a6a48');
  c.fillStyle = '#dfeccb';
  c.fillRect(64, 18, 28, 20);
  poly(c, [64, 38, 76, 24, 84, 32, 92, 38], '#86b96b');
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
  const [sh, s] = mk(28, 12);
  ellipse(s, 14, 6, 13, 5, 'rgba(0,0,0,0.22)');
  tx.addCanvas('shadow', sh);
}
