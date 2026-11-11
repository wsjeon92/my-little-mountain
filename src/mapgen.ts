/**
 * 산 지도 생성. 화면(DOM/Phaser)에 의존하지 않는 순수 계산이라
 * 나중에 서버에서도 같은 지도를 만들 수 있다. 시드가 고정이라 항상 같은 산이 나온다.
 */

export const TILE = 32;
export const MAP_W = 96;
export const MAP_H = 144;

/** 타일 번호. 0~11 은 고도대(4) × 명암(3) 바닥. */
export const T = {
  LEDGE: 12, // 12~15: 고도대별 절벽 단
  TRAIL: 16,
  TRAIL2: 17,
  YARD: 18,
  WATER: 19,
  WATER2: 20,
  BRIDGE: 21,
  SOIL: 22,
  PLOT: 23,
  TREE_A: 24,
  TREE_B: 25,
  PINE_A: 26,
  PINE_B: 27,
  BUSH: 28,
  ROCK: 29,
  FLOWER: 30,
  REED: 31,
  STUMP: 32,
} as const;
export const TILE_COUNT = 33;

export function isTree(t: number): boolean {
  return t >= T.TREE_A && t <= T.PINE_B;
}

export type Feature = 'gate' | 'spring' | 'bench' | 'deck' | 'stone';

export interface Place {
  id: string;
  name: string;
  tx: number;
  ty: number;
  feature?: Feature;
  hidden?: boolean;
}

/** 등산로 그래프의 점(갈림길·쉼터). hidden 은 길을 잇기 위한 보조점. */
export const PLACES: Place[] = [
  { id: 'gate', name: '등산로 입구', tx: 48, ty: 138, feature: 'gate' },
  { id: 'valley', name: '계곡 갈림길', tx: 44, ty: 118 },
  { id: 'spring', name: '약수터', tx: 26, ty: 108, feature: 'spring' },
  { id: 'bench', name: '통나무 쉼터', tx: 62, ty: 104, feature: 'bench' },
  { id: 'pension', name: '산중턱 펜션', tx: 53, ty: 87 },
  { id: 'deck', name: '전망대', tx: 76, ty: 66, feature: 'deck' },
  { id: 'ridge', name: '능선 갈림길', tx: 40, ty: 56 },
  { id: 'reeds', name: '억새밭', tx: 20, ty: 44, feature: 'bench' },
  { id: 'summit', name: '정상', tx: 48, ty: 16, feature: 'stone' },
  { id: 'yardW', name: '', tx: 45, ty: 86, hidden: true },
  { id: 'yardE', name: '', tx: 72, ty: 85, hidden: true },
  { id: 'yardS', name: '', tx: 53, ty: 90, hidden: true },
];

/** 등산로 그래프의 선. */
const EDGES: [string, string][] = [
  ['gate', 'valley'],
  ['valley', 'spring'],
  ['valley', 'bench'],
  ['spring', 'yardW'],
  ['bench', 'yardS'],
  ['yardW', 'ridge'],
  ['yardE', 'deck'],
  ['deck', 'ridge'],
  ['ridge', 'reeds'],
  ['ridge', 'summit'],
  ['reeds', 'summit'],
  ['deck', 'summit'],
];

/** 펜션 건물이 차지하는 칸과 문 앞 칸. */
export const PENSION = { x: 52, y: 78, w: 7, h: 5, door: { tx: 55, ty: 83 } };
export const YARD = { x0: 45, y0: 83, x1: 72, y1: 90 };
const FARM = { x0: 62, y0: 83, x1: 70, y1: 89 };

/** 텃밭 12칸(4열 × 3행). 칸 사이는 걸어다닐 수 있는 흙길. */
export const FARM_PLOTS: { tx: number; ty: number }[] = [];
for (const ty of [84, 86, 88]) for (const tx of [63, 65, 67, 69]) FARM_PLOTS.push({ tx, ty });

const SUMMIT = { x: 48, y: 16 };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 부드러운 무작위 값(0~1). 가까운 위치끼리 비슷한 값이 나온다. */
function noise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0);
  const b = hash(x0 + 1, y0);
  const c = hash(x0, y0 + 1);
  const d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** 높이 0(산 아래)~1(정상). */
export function height(tx: number, ty: number): number {
  const d = Math.hypot((tx - SUMMIT.x) * 1.25, ty - SUMMIT.y);
  const h = 1 - d / 130 + (noise(tx / 9, ty / 9) - 0.5) * 0.08;
  return Math.max(0, Math.min(1, h));
}

/** 화면에 보여줄 해발 고도(m). */
export function altitude(tx: number, ty: number): number {
  return Math.round(150 + height(tx, ty) * 720);
}

function band(h: number): number {
  return h < 0.3 ? 0 : h < 0.55 ? 1 : h < 0.8 ? 2 : 3;
}

function curve(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ampMax: number,
  phase: number,
  cb: (x: number, y: number) => void,
): void {
  const len = Math.hypot(bx - ax, by - ay);
  const n = Math.ceil(len * 4);
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  const k = Math.max(1, Math.round(len / 25));
  const amp = Math.min(ampMax, len * 0.12);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = Math.sin(t * Math.PI) * amp * Math.sin(t * Math.PI * 2 * k + phase);
    cb(ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off);
  }
}

export interface MountainMap {
  ground: number[][];
  decor: number[][];
  walk: Uint8Array;
}

let cached: MountainMap | undefined;

export function getMap(): MountainMap {
  if (cached) return cached;
  const rng = mulberry32(20261111);
  const ground: number[][] = [];
  const decor: number[][] = [];
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

  // 1) 바닥: 고도대 + 절벽 단
  for (let y = 0; y < MAP_H; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_W; x++) {
      const h = height(x, y);
      const b = band(h);
      const ledge = Math.floor(h * 12) > Math.floor(height(x, y + 1) * 12);
      const shade = Math.min(2, Math.floor(noise(x / 4 + 90, y / 4 + 90) * 3.2));
      row.push(ledge ? T.LEDGE + b : b * 3 + shade);
    }
    ground.push(row);
    decor.push(new Array<number>(MAP_W).fill(-1));
  }

  // 2) 계곡물
  const creek: [number, number][] = [
    [30, 48],
    [25, 78],
    [34, 100],
    [30, 112],
    [22, 126],
    [27, 143],
  ];
  for (let i = 0; i + 1 < creek.length; i++) {
    const [ax, ay] = creek[i];
    const [bx, by] = creek[i + 1];
    curve(ax, ay, bx, by, 1.5, i, (px, py) => {
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      for (const [dx, dy] of [[0, 0], [1, 0]] as const) {
        if (inMap(ix + dx, iy + dy)) {
          ground[iy + dy][ix + dx] = hash(ix + dx, iy + dy) < 0.5 ? T.WATER : T.WATER2;
        }
      }
    });
  }

  // 3) 펜션 마당과 텃밭
  for (let y = YARD.y0; y <= YARD.y1; y++) for (let x = YARD.x0; x <= YARD.x1; x++) ground[y][x] = T.YARD;
  for (let y = FARM.y0; y <= FARM.y1; y++) for (let x = FARM.x0; x <= FARM.x1; x++) ground[y][x] = T.SOIL;
  for (const p of FARM_PLOTS) ground[p.ty][p.tx] = T.PLOT;

  // 4) 등산로: 그래프의 선을 구불구불한 길 타일로 깐다
  const inBuilding = (x: number, y: number) =>
    x >= PENSION.x && x < PENSION.x + PENSION.w && y >= PENSION.y && y < PENSION.y + PENSION.h;
  const stamp = (x: number, y: number) => {
    if (!inMap(x, y) || inBuilding(x, y)) return;
    const g = ground[y][x];
    if (g === T.YARD || g === T.SOIL || g === T.PLOT || g === T.BRIDGE) return;
    if (g === T.WATER || g === T.WATER2) ground[y][x] = T.BRIDGE;
    else ground[y][x] = hash(x, y) < 0.7 ? T.TRAIL : T.TRAIL2;
  };
  const byId = new Map(PLACES.map((p) => [p.id, p]));
  EDGES.forEach(([a, b], i) => {
    const A = byId.get(a)!;
    const B = byId.get(b)!;
    curve(A.tx, A.ty, B.tx, B.ty, 4, i * 1.7, (px, py) => {
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      stamp(ix, iy);
      stamp(ix + 1, iy);
      stamp(ix, iy + 1);
      stamp(ix + 1, iy + 1);
    });
  });
  // 쉼터마다 작은 공터
  for (const p of PLACES) {
    if (p.hidden || p.id === 'pension') continue;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 10) continue;
        const x = p.tx + dx;
        const y = p.ty + dy;
        if (!inMap(x, y)) continue;
        if (ground[y][x] === T.WATER || ground[y][x] === T.WATER2) continue;
        stamp(x, y);
      }
  }

  // 5) 걸을 수 있는 칸
  const walk = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const g = ground[y][x];
      if (g === T.TRAIL || g === T.TRAIL2 || g === T.YARD || g === T.BRIDGE || g === T.SOIL) {
        walk[y * MAP_W + x] = 1;
      }
    }

  // 6) 나무·바위 등 장식 (길, 물, 건물 자리는 비운다)
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const g = ground[y][x];
      if (g >= T.TRAIL) continue;
      if (x >= PENSION.x - 1 && x <= PENSION.x + PENSION.w && y >= PENSION.y - 1 && y < PENSION.y + PENSION.h) continue;
      const b = g >= T.LEDGE ? g - T.LEDGE : Math.floor(g / 3);
      const d = noise(x / 6 + 40, y / 6 + 40);
      const r = rng();
      let t = -1;
      if (b === 0) {
        if (r < 0.2 + 0.5 * d) t = rng() < 0.5 ? T.TREE_A : T.TREE_B;
        else if (r < 0.3 + 0.5 * d) t = T.BUSH;
        else if (r > 0.95) t = T.FLOWER;
      } else if (b === 1) {
        if (r < 0.2 + 0.5 * d) t = rng() < 0.6 ? T.PINE_A : T.PINE_B;
        else if (r < 0.27 + 0.5 * d) t = rng() < 0.5 ? T.TREE_B : T.BUSH;
        else if (r > 0.97) t = T.ROCK;
      } else if (b === 2) {
        if (r < 0.05 + 0.25 * d) t = T.PINE_B;
        else if (r < 0.15 + 0.5 * d) t = T.REED;
        else if (r > 0.93) t = T.ROCK;
      } else {
        if (r < 0.14) t = T.ROCK;
        else if (r < 0.2) t = T.REED;
      }
      decor[y][x] = t;
    }

  cached = { ground, decor, walk };
  return cached;
}
