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
  salad: { name: '상추 샐러드', emoji: '🥗', kind: 'dish' },
  soup: { name: '당근 수프', emoji: '🍲', kind: 'dish' },
  stew: { name: '토마토 스튜', emoji: '🥘', kind: 'dish' },
  skewer: { name: '모둠 채소구이', emoji: '🍢', kind: 'dish' },
  grilled: { name: '생선구이', emoji: '🍽️', kind: 'dish' },
  ssam: { name: '생선 쌈밥', emoji: '🍱', kind: 'dish' },
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

export const FISH_IDS: ItemId[] = FISH_ODDS.map(([id]) => id);

/** 요리법. anyFish 는 물고기 종류를 가리지 않는다는 뜻. 요리마다 장작 1개가 더 든다. */
export interface Recipe {
  dish: ItemId;
  needs: Partial<Record<ItemId | 'anyFish', number>>;
}
export const RECIPES: Recipe[] = [
  { dish: 'salad', needs: { lettuce: 2 } },
  { dish: 'soup', needs: { carrot: 2 } },
  { dish: 'stew', needs: { tomato: 2, carrot: 1 } },
  { dish: 'skewer', needs: { lettuce: 1, carrot: 1, tomato: 1 } },
  { dish: 'grilled', needs: { anyFish: 1 } },
  { dish: 'ssam', needs: { anyFish: 1, lettuce: 2 } },
];

export function needsText(r: Recipe): string {
  const parts = Object.entries(r.needs).map(([k, n]) => `${k === 'anyFish' ? '물고기' : ITEMS[k as ItemId].name} ${n}`);
  return [...parts, '장작 1'].join(' · ');
}

/** 받침 유무에 따라 '을/를'을 붙인다. */
export function eul(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code % 28 !== 0 ? '을' : '를');
}
