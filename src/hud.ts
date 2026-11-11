import { CROPS, CROP_IDS, type CropId } from './crops';
import { state } from './state';
import { getMap, MAP_W, MAP_H, PLACES, PENSION } from './mapgen';
import { tileColor } from './art';

/** 화면 위에 겹쳐 보이는 글자·버튼(HTML). 게임 그림과 분리해 한글이 또렷하게 보이게 한다. */

const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;

export function setPlace(name: string, alt?: number): void {
  $('place-name').textContent = name;
  $('place-alt').textContent = alt === undefined ? '' : `해발 ${alt}m`;
}

export function refreshInventory(): void {
  $('inv').textContent =
    `🪵 ${state.wood}   ` + CROP_IDS.map((c) => `${CROPS[c].emoji} ${state.inventory[c]}`).join('   ');
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
}

export function showSeedPicker(onPick: (c: CropId) => void): void {
  const panel = $('panel');
  panel.innerHTML = '<div class="panel-title">무엇을 심을까요?</div>';
  const row = document.createElement('div');
  row.className = 'panel-row';
  for (const id of CROP_IDS) {
    const b = document.createElement('button');
    b.innerHTML = `<span class="em">${CROPS[id].emoji}</span>${CROPS[id].name}<small>${fmtRemain(CROPS[id].growMs)}</small>`;
    b.onclick = () => {
      hidePanel();
      onPick(id);
    };
    row.appendChild(b);
  }
  panel.appendChild(row);
  const close = document.createElement('button');
  close.className = 'panel-close';
  close.textContent = '닫기';
  close.onclick = hidePanel;
  panel.appendChild(close);
  panel.classList.add('show');
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
  refreshInventory();
}
