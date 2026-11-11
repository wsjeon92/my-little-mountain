/** 가방에 들어가는 모든 물건의 정의. 새 물건은 여기에 한 줄 추가한다. */

export type ItemKind = 'material' | 'crop' | 'fish' | 'dish';

export interface ItemDef {
  name: string;
  emoji: string;
  kind: ItemKind;
}

export const ITEMS = {
  wood: { name: '장작', emoji: '🪵', kind: 'material' },
  stone: { name: '돌', emoji: '🪨', kind: 'material' },
  lettuce: { name: '상추', emoji: '🥬', kind: 'crop' },
  carrot: { name: '당근', emoji: '🥕', kind: 'crop' },
  tomato: { name: '토마토', emoji: '🍅', kind: 'crop' },
  minnow: { name: '피라미', emoji: '🐟', kind: 'fish' },
  trout: { name: '산천어', emoji: '🐠', kind: 'fish' },
  mandarin: { name: '쏘가리', emoji: '🐡', kind: 'fish' },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export const KIND_LABEL: Record<ItemKind, string> = {
  material: '재료',
  crop: '작물',
  fish: '물고기',
  dish: '요리',
};

/** 물고기별 잡힐 확률(합 1). 흔한 것부터. */
export const FISH_ODDS: [ItemId, number][] = [
  ['minnow', 0.6],
  ['trout', 0.3],
  ['mandarin', 0.1],
];

/** 받침 유무에 따라 '을/를'을 붙인다. */
export function eul(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code % 28 !== 0 ? '을' : '를');
}
