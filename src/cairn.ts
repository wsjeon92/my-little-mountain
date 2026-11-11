/**
 * 정상의 돌탑. 탑은 하나이고, 올린 돌 수에 따라 모양과 높이가 달라진다.
 * 올린 돌 하나가 그림 속 돌 하나다.
 *  - 돌이 적을 때: 낮고 둥근 돌무더기
 *  - 늘어나면: 원뿔 모양 탑
 *  - 많아지면: 밑이 넓게 퍼지고 위가 뾰족한 높은 탑
 */

/** 이 수를 넘으면 탑 모양은 더 커지지 않고 올린 돌 수만 늘어난다. */
export const CAIRN_CAP = 400;

const K = 1.2; // 그림 배율
const BASE_W = 220;
const BASE_H = 300;
export const CAIRN_W = Math.round(BASE_W * K);
export const CAIRN_H = Math.round(BASE_H * K);

const SW = 8; // 돌 하나의 너비
const RH = 5.4; // 한 줄의 높이

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** 돌 n개로 쌓은 탑의 줄별 돌 수(아래에서 위로). 합은 정확히 n. */
export function towerRows(n: number): number[] {
  n = Math.min(CAIRN_CAP, Math.max(0, Math.floor(n)));
  if (n === 0) return [];
  const t = Math.log(n) / Math.log(CAIRN_CAP); // 0(돌 1개) ~ 1(가득)
  const aspect = lerp(0.7, 2.9, t); // 밑너비 대비 높이: 낮은 무더기 → 높은 탑
  const curve = lerp(0.6, 1.3, t); // 옆선: 둥글게 부푼 모양 → 밑이 퍼진 뾰족한 모양
  // 돌 n개가 다 들어가는 가장 작은 탑을 찾는다.
  for (let base = 1; ; base += 0.1) {
    const count = Math.max(1, Math.round(base * aspect));
    const rows: number[] = [];
    for (let r = 0; r < count; r++) rows.push(Math.max(1, Math.round(base * Math.pow(1 - r / count, curve))));
    let sum = rows.reduce((a, b) => a + b, 0);
    if (sum < n) continue;
    // 남는 자리만큼 꼭대기부터 덜어낸다.
    for (let r = rows.length - 1; sum > n; r--) {
      const cut = Math.min(rows[r], sum - n);
      rows[r] -= cut;
      sum -= cut;
    }
    return rows.filter((k) => k > 0);
  }
}

export function cairnName(n: number): string {
  return n <= 0 ? '돌탑 터' : n < 6 ? '돌무더기' : n < 40 ? '작은 돌탑' : n < 150 ? '돌탑' : '큰 돌탑';
}

function hash(a: number, b: number): number {
  let h = Math.imul(a + 1, 374761393) ^ Math.imul(b + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const STONE = ['#9c9486', '#b3ab9b', '#857c6d', '#c4bcab', '#a0937f', '#8f8a7e', '#b8ad97'];

/** 돌탑을 그린다. 반환값은 탑의 높이(px). */
export function drawCairn(c: CanvasRenderingContext2D, n: number): number {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, CAIRN_W, CAIRN_H);
  c.scale(K, K);
  const bx = BASE_W / 2;
  const by = BASE_H - 12;
  const rows = towerRows(n);
  if (!rows.length) {
    // 빈 터: 돌 놓을 자리를 잔돌 몇 개로 표시
    for (const [x, col] of [[-12, '#8f8a7e'], [10, '#a39e92'], [0, '#b6b1a6']] as const) {
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(bx + x, by + (x ? 0 : 3), 3.5, 2.2, 0, 0, Math.PI * 2);
      c.fill();
    }
    return 0;
  }
  c.fillStyle = 'rgba(40,34,26,0.28)';
  c.beginPath();
  c.ellipse(bx, by + 3, rows[0] * SW * 0.5 + 5, 5.5, 0, 0, Math.PI * 2);
  c.fill();
  rows.forEach((k, r) => {
    const y = by - r * RH;
    for (let j = 0; j < k; j++) {
      const x = bx + (j - (k - 1) / 2) * SW * 0.86 + (hash(r, j) - 0.5) * 2.4;
      const yy = y + (hash(j + 50, r) - 0.5) * 1.6;
      const w = SW / 2 + 0.6 + hash(r + 9, j) * 1.2;
      c.fillStyle = '#4f4a42';
      c.beginPath();
      c.ellipse(x, yy + 1.3, w, 3.3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = STONE[Math.floor(hash(r, j + 31) * STONE.length)];
      c.beginPath();
      c.ellipse(x, yy, w, 3.1, 0, 0, Math.PI * 2);
      c.fill();
      // 가장자리 돌은 어둡게 해서 둥근 탑처럼 보이게 한다.
      const edge = k > 1 ? Math.abs(j - (k - 1) / 2) / ((k - 1) / 2) : 0;
      c.fillStyle = `rgba(30,26,20,${(edge * edge * 0.28).toFixed(3)})`;
      c.beginPath();
      c.ellipse(x, yy, w, 3.1, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.26)';
      c.beginPath();
      c.ellipse(x - 1, yy - 1.1, w * 0.5, 1.1, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
  return (rows.length * RH + 6) * K;
}
