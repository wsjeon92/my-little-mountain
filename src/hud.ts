import { CROPS, CROP_IDS, type CropId } from './crops';
import { ITEMS, KIND_LABEL, type ItemId, type ItemKind } from './items';
import { count, ownedItems } from './state';
import { getMap, MAP_W, MAP_H, PLACES, PENSION } from './mapgen';
import { tileColor } from './art';

/** 화면 위에 겹쳐 보이는 글자·버튼(HTML). 게임 그림과 분리해 한글이 또렷하게 보이게 한다. */

const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;

export function setPlace(name: string, alt?: number): void {
  $('place-name').textContent = name;
  $('place-alt').textContent = alt === undefined ? '' : `해발 ${alt}m`;
}

let panelKind: 'none' | 'bag' | 'other' = 'none';

/** 가진 물건이 바뀌었을 때 부른다. 가방이 열려 있으면 다시 그린다. */
export function refreshInventory(): void {
  if (panelKind === 'bag' && $('panel').classList.contains('show')) showBag();
}

/** 가방 안 물건 옆에 붙는 버튼(예: 요리 '먹기'). 종류별로 등록한다. */
const bagButtons: Partial<Record<ItemKind, { label: string; run: (id: ItemId) => void }>> = {};
export function setBagButton(kind: ItemKind, label: string, run: (id: ItemId) => void): void {
  bagButtons[kind] = { label, run };
}
let bagNote: (() => string) | undefined;
export function setBagNote(fn: () => string): void {
  bagNote = fn;
}

export function showBag(): void {
  const panel = $('panel');
  panel.innerHTML = '<div class="panel-title">가방</div>';
  const box = document.createElement('div');
  box.className = 'bag';
  const owned = ownedItems();
  if (!owned.length) box.innerHTML = '<div class="bag-empty">아직 아무것도 없어요</div>';
  for (const kind of ['material', 'crop', 'fish', 'dish'] as ItemKind[]) {
    const ids = owned.filter((id) => ITEMS[id].kind === kind);
    if (!ids.length) continue;
    const g = document.createElement('div');
    g.className = 'bag-group';
    g.textContent = KIND_LABEL[kind];
    box.appendChild(g);
    for (const id of ids) {
      const row = document.createElement('div');
      row.className = 'bag-item';
      row.innerHTML = `<span class="em">${ITEMS[id].emoji}</span><span class="nm">${ITEMS[id].name}</span><span class="ct">${count(id)}</span>`;
      const btn = bagButtons[kind];
      if (btn) {
        const b = document.createElement('button');
        b.textContent = btn.label;
        b.onclick = () => btn.run(id);
        row.appendChild(b);
      }
      box.appendChild(row);
    }
  }
  const note = bagNote?.();
  if (note) {
    const n = document.createElement('div');
    n.className = 'bag-note';
    n.textContent = note;
    box.appendChild(n);
  }
  panel.appendChild(box);
  addClose(panel);
  panel.classList.add('show');
  panelKind = 'bag';
}

function addClose(panel: HTMLElement): void {
  const close = document.createElement('button');
  close.className = 'panel-close';
  close.textContent = '닫기';
  close.onclick = hidePanel;
  panel.appendChild(close);
}

export interface Choice {
  emoji: string;
  name: string;
  small?: string;
}

/** 아래쪽에 고르기 창을 띄운다(씨앗, 카페 메뉴 등). */
export function showChoices(title: string, choices: Choice[], onPick: (index: number) => void): void {
  const panel = $('panel');
  panel.innerHTML = '';
  const t = document.createElement('div');
  t.className = 'panel-title';
  t.textContent = title;
  panel.appendChild(t);
  const row = document.createElement('div');
  row.className = 'panel-row';
  choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="em">${c.emoji}</span>${c.name}${c.small ? `<small>${c.small}</small>` : ''}`;
    b.onclick = () => {
      hidePanel();
      onPick(i);
    };
    row.appendChild(b);
  });
  panel.appendChild(row);
  addClose(panel);
  panel.classList.add('show');
  panelKind = 'other';
}

let toastTimer: number | undefined;
export function toast(msg: string, ms = 2600): void {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer !== undefined) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
}

export function fmtRemain(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}분 ${s % 60}초` : `${s}초`;
}

export function hidePanel(): void {
  $('panel').classList.remove('show');
  panelKind = 'none';
}

export function showSeedPicker(onPick: (c: CropId) => void): void {
  showChoices(
    '무엇을 심을까요?',
    CROP_IDS.map((id) => ({ emoji: CROPS[id].emoji, name: CROPS[id].name, small: fmtRemain(CROPS[id].growMs) })),
    (i) => onPick(CROP_IDS[i]),
  );
}

// ── 미니맵 ───────────────────────────────────────────────
const MM = 2; // 타일 한 칸 = 2px
let base: HTMLCanvasElement | undefined;

function buildBase(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = MAP_W * MM;
  c.height = MAP_H * MM;
  const g = c.getContext('2d')!;
  const map = getMap();
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      g.fillStyle = tileColor(map.ground[y][x]);
      g.fillRect(x * MM, y * MM, MM, MM);
    }
  g.fillStyle = '#a8503c';
  g.fillRect(PENSION.x * MM, PENSION.y * MM, PENSION.w * MM, PENSION.h * MM);
  for (const p of PLACES) {
    if (p.hidden) continue;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(p.tx * MM, p.ty * MM, 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5b3d22';
    g.beginPath();
    g.arc(p.tx * MM, p.ty * MM, 1.6, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export function drawMinimap(tx: number, ty: number): void {
  const wrap = $('minimap-wrap');
  if (!wrap.classList.contains('show')) return;
  base ??= buildBase();
  const cv = $<HTMLCanvasElement>('minimap');
  if (cv.width !== base.width) {
    cv.width = base.width;
    cv.height = base.height;
  }
  const g = cv.getContext('2d')!;
  g.drawImage(base, 0, 0);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(tx * MM + 1, ty * MM + 1, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e0483a';
  g.beginPath();
  g.arc(tx * MM + 1, ty * MM + 1, 3.5, 0, Math.PI * 2);
  g.fill();
}

export function setMapButtonVisible(v: boolean): void {
  $('mapbtn').style.display = v ? '' : 'none';
  if (!v) $('minimap-wrap').classList.remove('show');
}

export function initHud(onMapToggle: () => void): void {
  $('mapbtn').onclick = () => {
    $('minimap-wrap').classList.toggle('show');
    onMapToggle();
  };
  $('minimap-wrap').onclick = () => $('minimap-wrap').classList.remove('show');
  $('bagbtn').onclick = () => {
    if (panelKind === 'bag') hidePanel();
    else showBag();
  };
}
