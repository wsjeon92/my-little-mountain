import { CROPS, type CropId } from './crops';
import { FISH_ODDS, ITEM_IDS, type ItemId } from './items';

/**
 * 게임 상태와, 상태를 바꾸는 유일한 통로(actions).
 * 화면(Phaser)은 이 파일의 상태를 읽어서 그리기만 한다.
 * 멀티 유저로 갈 때는 actions 의 구현만 서버 호출로 바꾸면 된다.
 */

export type SceneId = 'mountain' | 'pension';

export interface Plot {
  crop: CropId | null;
  plantedAt: number;
}

export interface MoveIntent {
  from: [number, number];
  to: [number, number];
  at: number;
}

export interface GameState {
  version: 2;
  playerId: string;
  player: { scene: SceneId; tx: number; ty: number; lastMove?: MoveIntent };
  farm: { ownerId: string; plots: Plot[] };
  /** 가방: 물건 → 개수 */
  items: Partial<Record<ItemId, number>>;
  visited: string[];
  /** 벤 나무·캔 바위: "tx,ty" → 채집한 시각. 다시 생기면 지운다. (멀티에서는 모두가 함께 보는 월드 상태) */
  gathered: Record<string, number>;
  /** 벽난로 불이 꺼지는 시각 */
  fireUntil: number;
  /** 정상 돌탑에 올린 돌 수 (멀티에서는 모두가 함께 쌓는 월드 상태) */
  cairn: number;
}

const KEY = 'my-little-mountain:v1';
export const PLOT_COUNT = 12;
/** 벤 나무가 다시 자라는 데 걸리는 실제 시간 */
export const TREE_MS = 10 * 60_000;
/** 캔 바위가 다시 생기는 데 걸리는 실제 시간 */
export const ROCK_MS = 15 * 60_000;
/** 장작 하나가 벽난로에서 타는 시간 */
export const FIRE_MS = 10 * 60_000;

function fresh(): GameState {
  const id = 'p-' + Math.random().toString(36).slice(2, 10);
  return {
    version: 2,
    playerId: id,
    player: { scene: 'mountain', tx: -1, ty: -1 },
    farm: {
      ownerId: id,
      plots: Array.from({ length: PLOT_COUNT }, () => ({ crop: null, plantedAt: 0 })),
    },
    items: {},
    visited: [],
    gathered: {},
    fireUntil: 0,
    cairn: 0,
  };
}

/** 이전 버전 저장 데이터를 지금 구조로 옮긴다. */
function migrate(raw: Record<string, unknown>): GameState | null {
  const farm = raw.farm as GameState['farm'] | undefined;
  if (!farm?.plots || farm.plots.length !== PLOT_COUNT) return null;
  if (raw.version === 1) {
    // v0.1~0.2: 작물은 inventory, 장작은 wood, 벤 나무는 trees 에 따로 있었다.
    raw.items = { ...((raw.inventory as object) ?? {}), wood: (raw.wood as number) ?? 0 };
    raw.gathered = raw.trees ?? {};
    delete raw.inventory;
    delete raw.wood;
    delete raw.trees;
    raw.version = 2;
  }
  if (raw.version !== 2) return null;
  const s = raw as unknown as GameState;
  s.items ??= {};
  s.gathered ??= {};
  s.fireUntil ??= 0;
  s.cairn ??= 0;
  s.visited ??= [];
  return s;
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = migrate(JSON.parse(raw));
      if (s) return s;
    }
  } catch {
    /* 저장소를 못 쓰는 환경이면 새 상태로 시작 */
  }
  return fresh();
}

export const state: GameState = load();

let saveTimer: number | undefined;
export function save(now = false): void {
  const write = () => {
    saveTimer = undefined;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* 무시: 저장 실패해도 플레이는 계속 */
    }
  };
  if (now) {
    if (saveTimer !== undefined) clearTimeout(saveTimer);
    write();
  } else if (saveTimer === undefined) {
    saveTimer = window.setTimeout(write, 800);
  }
}

window.addEventListener('pagehide', () => save(true));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save(true);
});

export function count(id: ItemId): number {
  return state.items[id] ?? 0;
}

function give(id: ItemId, n: number): void {
  state.items[id] = Math.max(0, count(id) + n);
}

export function ownedItems(): ItemId[] {
  return ITEM_IDS.filter((id) => count(id) > 0);
}

export type PlotView =
  | { kind: 'empty' }
  | { kind: 'growing'; crop: CropId; stage: 0 | 1 | 2; remainMs: number }
  | { kind: 'ready'; crop: CropId; stage: 3 };

export function viewPlot(i: number, now = Date.now()): PlotView {
  const p = state.farm.plots[i];
  if (!p.crop) return { kind: 'empty' };
  const total = CROPS[p.crop].growMs;
  const t = (now - p.plantedAt) / total;
  if (t >= 1) return { kind: 'ready', crop: p.crop, stage: 3 };
  const stage = t < 0.2 ? 0 : t < 0.6 ? 1 : 2;
  return { kind: 'growing', crop: p.crop, stage, remainMs: total - (now - p.plantedAt) };
}

export const actions = {
  /** 이동은 좌표가 아니라 "어디서 어디로 출발했다"는 의도만 남긴다. */
  moveIntent(from: [number, number], to: [number, number]): void {
    state.player.lastMove = { from, to, at: Date.now() };
  },
  setPosition(scene: SceneId, tx: number, ty: number): void {
    state.player.scene = scene;
    state.player.tx = tx;
    state.player.ty = ty;
    save();
  },
  visit(placeId: string): boolean {
    if (state.visited.includes(placeId)) return false;
    state.visited.push(placeId);
    save();
    return true;
  },
  plant(i: number, crop: CropId): boolean {
    const p = state.farm.plots[i];
    if (p.crop) return false;
    p.crop = crop;
    p.plantedAt = Date.now();
    save(true);
    return true;
  },
  harvest(i: number): CropId | null {
    const v = viewPlot(i);
    if (v.kind !== 'ready') return null;
    give(v.crop, 1);
    state.farm.plots[i] = { crop: null, plantedAt: 0 };
    save(true);
    return v.crop;
  },
  /** 나무를 베거나 바위를 캐서 물건 하나를 얻는다. */
  gather(tx: number, ty: number, item: ItemId): boolean {
    const k = `${tx},${ty}`;
    if (state.gathered[k]) return false;
    state.gathered[k] = Date.now();
    give(item, 1);
    save(true);
    return true;
  },
  regrow(key: string): void {
    delete state.gathered[key];
    save();
  },
  addFirewood(): boolean {
    if (count('wood') <= 0) return false;
    give('wood', -1);
    state.fireUntil = Math.max(Date.now(), state.fireUntil) + FIRE_MS;
    save(true);
    return true;
  },
  /** 정상 돌탑에 돌 하나를 올린다. */
  placeStone(): boolean {
    if (count('stone') <= 0) return false;
    give('stone', -1);
    state.cairn += 1;
    save(true);
    return true;
  },
  /** 물고기 한 마리를 낚는다. 어떤 물고기인지는 확률로 정해진다. */
  catchFish(): ItemId {
    let r = Math.random();
    let got = FISH_ODDS[0][0];
    for (const [id, p] of FISH_ODDS) {
      if (r < p) {
        got = id;
        break;
      }
      r -= p;
    }
    give(got, 1);
    save(true);
    return got;
  },
};
