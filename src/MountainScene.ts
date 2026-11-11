import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { altitude, FARM_PLOTS, getMap, isTree, MAP_H, MAP_W, PENSION, PLACES, T, TILE, YARD } from './mapgen';
import { actions, REGROW_MS, state, viewPlot } from './state';
import { CROPS } from './crops';
import * as hud from './hud';

const FONT = 'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

/** 받침 유무에 따라 '을/를'을 붙인다. */
function eul(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code % 28 !== 0 ? '을' : '를');
}

export class MountainScene extends BaseScene {
  private crops: Phaser.GameObjects.Image[] = [];
  private currentPlace = '';
  private decorLayer!: Phaser.Tilemaps.TilemapLayer;
  private axe!: Phaser.GameObjects.Image;
  private chopping?: { timer: Phaser.Time.TimerEvent; tween: Phaser.Tweens.Tween };

  constructor() {
    super('mountain');
  }

  create(): void {
    const map = getMap();
    this.initGrid(MAP_W, MAP_H, map.walk);
    this.speed = 165;
    this.cameras.main.setBackgroundColor('#6aa35c');

    // 바닥과 장식(나무 등) 두 겹의 타일 지도
    for (const [data, depth] of [
      [map.ground, -20],
      [map.decor, -10],
    ] as const) {
      const tm = this.make.tilemap({ data: data as number[][], tileWidth: TILE, tileHeight: TILE });
      const ts = tm.addTilesetImage('tiles', 'tiles', TILE, TILE, 1, 2)!;
      const layer = tm.createLayer(0, ts, 0, 0)!.setDepth(depth);
      if (data === map.decor) this.decorLayer = layer;
    }
    this.chopping = undefined;
    this.refreshTrees(true);

    // 쉼터 표지판과 구조물
    for (const p of PLACES) {
      if (p.hidden) continue;
      const sx = (p.tx - 2 + 0.5) * TILE;
      const sy = (p.ty - 1) * TILE;
      if (p.id !== 'pension') {
        this.add.image(sx, sy, 'sign').setOrigin(0.5, 1).setDepth(sy);
        this.label(sx, sy - 34, p.name);
      }
      if (p.feature === 'gate') {
        const gy = (p.ty - 2) * TILE;
        this.add.image((p.tx + 1) * TILE, gy, 'f_gate').setOrigin(0.5, 1).setDepth(gy);
      } else if (p.feature) {
        const fy = (p.ty - 1) * TILE;
        this.add.image((p.tx + 2.5) * TILE, fy, 'f_' + p.feature).setOrigin(0.5, 1).setDepth(fy);
      }
    }

    // 펜션
    const px = (PENSION.x + PENSION.w / 2) * TILE;
    const py = (PENSION.y + PENSION.h) * TILE;
    this.add.image(px, py + 6, 'pension').setOrigin(0.5, 1).setDepth(py - 1);
    this.interactables.push({
      hit: new Phaser.Geom.Rectangle(PENSION.x * TILE, (PENSION.y - 1) * TILE, PENSION.w * TILE, (PENSION.h + 1) * TILE),
      approach: PENSION.door,
      onArrive: () => {
        actions.setPosition('pension', 6, 7);
        this.scene.start('pension');
      },
    });

    // 텃밭
    this.crops = [];
    FARM_PLOTS.forEach((p, i) => {
      const img = this.add
        .image((p.tx + 0.5) * TILE, (p.ty + 0.5) * TILE, 'crop_lettuce_0')
        .setDepth((p.ty + 1) * TILE - 1)
        .setVisible(false);
      this.crops.push(img);
      this.interactables.push({
        hit: new Phaser.Geom.Rectangle(p.tx * TILE, p.ty * TILE, TILE, TILE),
        approach: { tx: p.tx, ty: p.ty + 1 },
        onArrive: () => this.usePlot(i),
      });
    });
    const farmLabelX = (FARM_PLOTS[0].tx + FARM_PLOTS[3].tx + 1) * 0.5 * TILE;
    this.label(farmLabelX, FARM_PLOTS[0].ty * TILE - 10, '텃밭');
    this.refreshCrops();
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.refreshCrops();
        this.refreshTrees(false);
      },
    });

    // 플레이어
    const gate = PLACES[0];
    let { tx, ty } = state.player;
    if (state.player.scene !== 'mountain' || tx < 0 || !map.walk[ty * MAP_W + tx]) {
      tx = gate.tx;
      ty = gate.ty;
    }
    this.createPlayer(tx, ty);
    this.axe = this.add.image(0, -12, 'axe').setOrigin(0.5, 0.95).setVisible(false);
    this.player.add(this.axe);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    cam.startFollow(this.player, true, 0.12, 0.12);
    const fit = () => {
      this.minZoom = Math.max(0.5, this.scale.width / (MAP_W * TILE), this.scale.height / (MAP_H * TILE));
      this.setZoom(cam.zoom);
    };
    cam.setZoom(this.scale.width < 600 ? 1 : 1.3);
    fit();
    this.scale.on('resize', fit);
    this.events.once('shutdown', () => this.scale.off('resize', fit));

    this.setupInput();
    hud.setMapButtonVisible(true);
    this.currentPlace = '';
    this.onStep(tx, ty);
    if (!state.visited.length || state.visited.length === 1) {
      hud.toast('가고 싶은 곳을 누르면 걸어갑니다 · 길가 나무를 누르면 장작을 얻어요', 6000);
    }
  }

  private label(x: number, y: number, text: string): void {
    this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#3b2f22',
        strokeThickness: 4,
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(1e6);
  }

  /** 벤 나무는 그루터기로, 시간이 지난 그루터기는 다시 나무로 그린다. */
  private refreshTrees(initial: boolean): void {
    const map = getMap();
    const now = Date.now();
    for (const key of Object.keys(state.trees)) {
      const [x, y] = key.split(',').map(Number);
      if (now - state.trees[key] >= REGROW_MS) {
        actions.regrow(key);
        this.decorLayer.putTileAt(map.decor[y][x], x, y);
      } else if (initial) {
        this.decorLayer.putTileAt(T.STUMP, x, y);
      }
    }
  }

  /** 길가 나무를 누르면 옆 길로 걸어가 벤다. */
  protected tapWorld(wx: number, wy: number): boolean {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    if (!isTree(getMap().decor[ty][tx])) return false;
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        if (!this.walk[ny * MAP_W + nx]) continue;
        const d = Math.hypot(nx - this.ptx, ny - this.pty) + (dx && dy ? 0.5 : 0);
        if (d < bd) {
          bd = d;
          best = [nx, ny];
        }
      }
    if (!best) return false; // 길에서 먼 나무는 그냥 걷기로 처리
    this.goTo(best[0], best[1], () => this.startChop(tx, ty));
    return true;
  }

  private startChop(tx: number, ty: number): void {
    const cutAt = state.trees[`${tx},${ty}`];
    if (cutAt) {
      hud.toast(`다시 자라는 중 · ${hud.fmtRemain(REGROW_MS - (Date.now() - cutAt))}`);
      return;
    }
    const dir = tx < this.ptx ? -1 : 1;
    this.sprite.setFlipX(dir < 0);
    this.axe.setVisible(true).setPosition(dir * 11, -12).setFlipX(dir < 0).setAngle(-50 * dir);
    const tween = this.tweens.add({
      targets: this.axe,
      angle: 60 * dir,
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeIn',
    });
    const timer = this.time.delayedCall(1700, () => {
      this.stopChop();
      if (actions.chop(tx, ty)) {
        this.decorLayer.putTileAt(T.STUMP, tx, ty);
        hud.refreshInventory();
        hud.toast('🪵 장작을 얻었어요');
      }
    });
    this.chopping = { timer, tween };
  }

  private stopChop(): void {
    if (!this.chopping) return;
    this.chopping.timer.remove();
    this.chopping.tween.stop();
    this.chopping = undefined;
    this.axe.setVisible(false);
  }

  protected onLeave(): void {
    this.stopChop();
  }

  private refreshCrops(): void {
    this.crops.forEach((img, i) => {
      const v = viewPlot(i);
      if (v.kind === 'empty') {
        img.setVisible(false);
        return;
      }
      img.setTexture(`crop_${v.crop}_${v.stage}`).setVisible(true);
    });
  }

  private usePlot(i: number): void {
    const v = viewPlot(i);
    if (v.kind === 'empty') {
      hud.showSeedPicker((crop) => {
        if (actions.plant(i, crop)) {
          hud.toast(`${CROPS[crop].name} 씨앗을 심었어요`);
          this.refreshCrops();
        }
      });
    } else if (v.kind === 'growing') {
      hud.toast(`${CROPS[v.crop].name} · 다 자라기까지 ${hud.fmtRemain(v.remainMs)}`);
    } else {
      const crop = actions.harvest(i);
      if (crop) {
        hud.toast(`${CROPS[crop].emoji} ${eul(CROPS[crop].name)} 거뒀어요`);
        hud.refreshInventory();
        this.refreshCrops();
      }
    }
  }

  protected onStep(tx: number, ty: number): void {
    actions.setPosition('mountain', tx, ty);
    let name = '등산로';
    for (const p of PLACES) {
      if (p.hidden) continue;
      const near =
        p.id === 'pension'
          ? tx >= YARD.x0 && tx <= YARD.x1 && ty >= YARD.y0 && ty <= YARD.y1
          : Math.abs(p.tx - tx) <= 4 && Math.abs(p.ty - ty) <= 4;
      if (near) {
        name = p.name;
        if (this.currentPlace !== p.id) {
          this.currentPlace = p.id;
          if (actions.visit(p.id) && p.id !== 'gate') hud.toast(`${p.name}에 처음 왔어요`);
        }
        break;
      }
    }
    if (name === '등산로') this.currentPlace = '';
    hud.setPlace(name, altitude(tx, ty));
    hud.drawMinimap(tx, ty);
  }

  redrawMinimap(): void {
    hud.drawMinimap(this.ptx, this.pty);
  }
}
