/** 격자 위 최단 경로(A*). 대각선 이동은 양옆 칸이 모두 걸을 수 있을 때만 허용한다. */
export function findPath(
  walk: Uint8Array,
  w: number,
  h: number,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): [number, number][] | null {
  const start = sy * w + sx;
  const goal = ty * w + tx;
  if (!walk[start] || !walk[goal]) return null;
  if (start === goal) return [];

  const g = new Float32Array(w * h).fill(Infinity);
  const from = new Int32Array(w * h).fill(-1);
  const closed = new Uint8Array(w * h);
  const heap: number[] = [];
  const f = new Float32Array(w * h);

  const heur = (i: number) => {
    const dx = Math.abs((i % w) - tx);
    const dy = Math.abs(((i / w) | 0) - ty);
    return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
  };
  const push = (i: number) => {
    heap.push(i);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (f[heap[p]] <= f[heap[c]]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1;
        const r = l + 1;
        let m = p;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === p) break;
        [heap[p], heap[m]] = [heap[m], heap[p]];
        p = m;
      }
    }
    return top;
  };

  g[start] = 0;
  f[start] = heur(start);
  push(start);

  while (heap.length) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % w;
    const cy = (cur / w) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!walk[ni] || closed[ni]) continue;
        if (dx && dy && (!walk[cy * w + nx] || !walk[ny * w + cx])) continue;
        const cost = g[cur] + (dx && dy ? 1.4142 : 1);
        if (cost < g[ni]) {
          g[ni] = cost;
          from[ni] = cur;
          f[ni] = cost + heur(ni);
          push(ni);
        }
      }
    }
  }

  if (from[goal] < 0) return null;
  const out: [number, number][] = [];
  for (let i = goal; i !== start; i = from[i]) out.push([i % w, (i / w) | 0]);
  return out.reverse();
}
