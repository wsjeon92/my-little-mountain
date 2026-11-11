export type CropId = 'lettuce' | 'carrot' | 'tomato';

export interface CropDef {
  name: string;
  emoji: string;
  /** 심은 뒤 다 자랄 때까지 걸리는 실제 시간(ms) */
  growMs: number;
}

export const CROPS: Record<CropId, CropDef> = {
  lettuce: { name: '상추', emoji: '🥬', growMs: 15_000 },
  carrot: { name: '당근', emoji: '🥕', growMs: 20_000 },
  tomato: { name: '토마토', emoji: '🍅', growMs: 30_000 },
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];
