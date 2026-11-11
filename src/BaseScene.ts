import Phaser from 'phaser';
import { TILE } from './mapgen';
import { findPath } from './pathfind';
import { actions } from './state';
import { hidePanel } from './hud';

export interface Interactable {
  /** 누르면 반응하는 영역(월드 좌표, px) */
  hit: Phaser.Geom.Rectangle;
  /** 그 앞에 가서 설 칸 */
  approach: { tx: number; ty: number };
  onArrive: () => void;
}

/** 산과 실내가 함께 쓰는 공통 동작: 격자, 클릭 이동, 확대·축소. */
export abstract class BaseScene extends Phaser.Scene {
  protected gw = 0;
  protected gh = 0;
  protected walk!: Uint8Array;
  protected player!: Phaser.GameObjects.Container;
  protected sprite!: Phaser.GameObjects.Image;
  protected ptx = 0;
  protected pty = 0;
  protected speed = 160;
  protected interactables: Interactable[] = [];
  protected busy = false;
  protected minZoom = 0.5;
  protected maxZoom = 2.2;

  private path: [number, number][] = [];
  private arriveCb?: () => void;
  private pinchDist = 0;
  private pinched = false;
  private walkT = 0;

  protected initGrid(w: number, h: number, walk: Uint8Array): void {
    this.gw = w;
    this.gh = h;
    this.walk = walk;
    this.interactables = [];
    this.path = [];
    this.arriveCb = undefined;
    this.busy = false;
    this.pinched = false;
  }

  protected createPlayer(tx: number, ty: number): void {
    this.ptx = tx;
    this.pty = ty;
    const shadow = this.add.image(0, 0, 'shadow');
    this.sprite = this.add.image(0, 0, 'player').setOrigin(0.5, 0.95);
    this.player = this.add.container((tx + 0.5) * TILE, (ty + 0.5) * TILE, [shadow, this.sprite]);
    this.player.setDepth(this.player.y);
  }

  protected setupInput(): void {
    this.input.addPointer(1);
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.setZoom(this.cameras.main.zoom * (dy > 0 ? 0.9 : 1.1));
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.pinched) {
        if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) this.pinched = false;
        return;
      }
      if (p.getDistance() > 12 || this.busy) return;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.handleTap(w.x, w.y);
    });
  }

  protected setZoom(z: number): void {
    this.cameras.main.setZoom(Phaser.Math.Clamp(z, this.minZoom, this.maxZoom));
  }

  private handleTap(wx: number, wy: number): void {
    hidePanel();
    if (this.tapIntercept()) return;
    for (const it of this.interactables) {
      if (it.hit.contains(wx, wy)) {
        this.goTo(it.approach.tx, it.approach.ty, it.onArrive);
        return;
      }
    }
    if (this.tapWorld(wx, wy)) return;
    const t = this.nearestWalkable(wx / TILE - 0.5, wy / TILE - 0.5);
    if (t) this.goTo(t[0], t[1]);
  }

  /** 누른 곳에서 가장 가까운, 걸을 수 있는 칸. 길 밖을 눌러도 길 위로 간다. */
  protected nearestWalkable(fx: number, fy: number): [number, number] | null {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let y = 0; y < this.gh; y++)
      for (let x = 0; x < this.gw; x++) {
        if (!this.walk[y * this.gw + x]) continue;
        const d = (x - fx) * (x - fx) + (y - fy) * (y - fy);
        if (d < bd) {
          bd = d;
          best = [x, y];
        }
      }
    return best;
  }

  protected goTo(tx: number, ty: number, cb?: () => void): void {
    // 지금 서 있는 칸에서 출발 (걷는 중이면 발밑 칸)
    let sx = Math.floor(this.player.x / TILE);
    let sy = Math.floor(this.player.y / TILE);
    if (!this.walk[sy * this.gw + sx]) {
      sx = this.ptx;
      sy = this.pty;
    }
    const path = findPath(this.walk, this.gw, this.gh, sx, sy, tx, ty);
    if (!path) return;
    this.onLeave();
    this.sprite.setTexture('player');
    actions.moveIntent([sx, sy], [tx, ty]);
    this.path = path;
    this.arriveCb = cb;
    if (!path.length) this.arrive();
  }

  private arrive(): void {
    const cb = this.arriveCb;
    this.arriveCb = undefined;
    this.sprite.y = 0;
    this.onStop(this.ptx, this.pty);
    cb?.();
  }

  /** 고정 대상이 아닌 것(나무 등)을 눌렀는지 장면별로 처리. 처리했으면 true. */
  protected tapWorld(_wx: number, _wy: number): boolean {
    return false;
  }
  /** 진행 중인 동작(낚시 등)이 이번 탭을 가져가면 true. */
  protected tapIntercept(): boolean {
    return false;
  }
  /** 한 칸 옮길 때마다 불린다. */
  protected onStep(_tx: number, _ty: number): void {}
  /** 멈춰 섰을 때 불린다. */
  protected onStop(_tx: number, _ty: number): void {}
  /** 다시 걷기 시작할 때 불린다. */
  protected onLeave(): void {}

  update(_time: number, delta: number): void {
    // 두 손가락 확대·축소
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1.isDown && p2.isDown) {
      const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.pinchDist > 0) this.setZoom((this.cameras.main.zoom * d) / this.pinchDist);
      this.pinchDist = d;
      this.pinched = true;
    } else {
      this.pinchDist = 0;
    }

    if (!this.path.length) return;
    let move = (this.speed * Math.min(delta, 250)) / 1000;
    while (move > 0 && this.path.length) {
      const [nx, ny] = this.path[0];
      const gx = (nx + 0.5) * TILE;
      const gy = (ny + 0.5) * TILE;
      const dx = gx - this.player.x;
      const dy = gy - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.5) this.sprite.setFlipX(dx < 0);
      if (dist <= move) {
        this.player.setPosition(gx, gy);
        move -= dist;
        this.path.shift();
        this.ptx = nx;
        this.pty = ny;
        this.onStep(nx, ny);
      } else {
        this.player.x += (dx / dist) * move;
        this.player.y += (dy / dist) * move;
        move = 0;
      }
    }
    this.player.setDepth(this.player.y);
    this.walkT += delta;
    this.sprite.y = -Math.abs(Math.sin(this.walkT / 90)) * 3;
    if (!this.path.length) this.arrive();
  }
}
