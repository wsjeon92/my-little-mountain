import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { altitude, FARM_PLOTS, getMap, MAP_H, MAP_W, PENSION, PLACES, TILE, YARD } from './mapgen';
import { actions, state, viewPlot } from './state';
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
      tm.createLayer(0, ts, 0, 0)!.setDepth(depth);
    }

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
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshCrops() });

    // 플레이어
    const gate = PLACES[0];
    let { tx, ty } = state.player;
    if (state.player.scene !== 'mountain' || tx < 0 || !map.walk[ty * MAP_W + tx]) {
      tx = gate.tx;
      ty = gate.ty;
    }
    this.createPlayer(tx, ty);

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
      hud.toast('마이리틀마운틴 · 가고 싶은 곳을 누르면 등산로를 따라 걸어갑니다', 5000);
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
