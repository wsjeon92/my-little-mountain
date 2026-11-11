import { CROPS, CROP_IDS, type CropId } from './crops';

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
  version: 1;
  playerId: string;
  player: { scene: SceneId; tx: number; ty: number; lastMove?: MoveIntent };
  farm: { ownerId: string; plots: Plot[] };
  inventory: Record<CropId, number>;
  visited: string[];
}

const KEY = 'my-little-mountain:v1';
export const PLOT_COUNT = 12;

function fresh(): GameState {
  const id = 'p-' + Math.random().toString(36).slice(2, 10);
  return {
    version: 1,
    playerId: id,
    player: { scene: 'mountain', tx: -1, ty: -1 },
    farm: {
      ownerId: id,
      plots: Array.from({ length: PLOT_COUNT }, () => ({ crop: null, plantedAt: 0 })),
    },
    inventory: { lettuce: 0, carrot: 0, tomato: 0 },
    visited: [],
  };
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as GameState;
      if (s && s.version === 1 && s.farm?.plots?.length === PLOT_COUNT) {
        for (const c of CROP_IDS) s.inventory[c] ??= 0;
        return s;
      }
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
    state.inventory[v.crop] += 1;
    state.farm.plots[i] = { crop: null, plantedAt: 0 };
    save(true);
    return v.crop;
  },
};
