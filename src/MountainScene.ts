import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import {
  altitude,
  CAFE,
  CAFE_YARD,
  FARM_PLOTS,
  getMap,
  isTree,
  MAP_H,
  MAP_W,
  PENSION,
  PLACES,
  T,
  TILE,
  YARD,
} from './mapgen';
import { actions, count, ROCK_MS, state, TREE_MS, viewPlot } from './state';
import { CROPS } from './crops';
import { eul, ITEMS, type ItemId } from './items';
import * as hud from './hud';
import { CAIRN_CAP, CAIRN_H, CAIRN_W, cairnName, drawCairn } from './cairn';

const FONT = 'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

/** 채집할 수 있는 것의 종류별 규칙. */
interface GatherRule {
  tool: string;
  item: ItemId;
  /** 채집한 자리에 남는 타일 */
  left: number;
  /** 다시 생기기까지 걸리는 시간 */
  ms: number;
  wait: string;
}
const TREE_RULE: GatherRule = { tool: 'axe', item: 'wood', left: T.STUMP, ms: TREE_MS, wait: '다시 자라는 중' };
const ROCK_RULE: GatherRule = { tool: 'pick', item: 'stone', left: T.RUBBLE, ms: ROCK_MS, wait: '바위가 다시 드러나는 중' };

function ruleOf(tile: number): GatherRule | null {
  if (isTree(tile)) return TREE_RULE;
  if (tile === T.ROCK) return ROCK_RULE;
  return null;
}

interface Fishing {
  phase: 'wait' | 'bite';
  bobber: Phaser.GameObjects.Arc;
  line: Phaser.GameObjects.Graphics;
  mark: Phaser.GameObjects.Text;
  timer: Phaser.Time.TimerEvent;
  tween?: Phaser.Tweens.Tween;
}

export class MountainScene extends BaseScene {
  private crops: Phaser.GameObjects.Image[] = [];
  private currentPlace = '';
  private decorLayer!: Phaser.Tilemaps.TilemapLayer;
  private tool!: Phaser.GameObjects.Image;
  private working?: { timer: Phaser.Time.TimerEvent; tween: Phaser.Tweens.Tween };
  private cairn!: Phaser.GameObjects.Image;
  private cairnTex!: Phaser.Textures.CanvasTexture;
  private cairnBaseY = 0;
  private cairnLabel!: Phaser.GameObjects.Text;
  private fishing?: Fishing;

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
    this.working = undefined;
    this.fishing = undefined;
    this.refreshGathered(true);

    // 쉼터 표지판과 구조물
    for (const p of PLACES) {
      if (p.hidden) continue;
      const sx = (p.tx - 2 + 0.5) * TILE;
      const sy = (p.ty - 1) * TILE;
      if (p.id !== 'pension' && p.id !== 'cafe') {
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

    // 정상 돌탑
    const summit = PLACES.find((p) => p.id === 'summit')!;
    const cx = (summit.tx + 0.5) * TILE;
    const cy = (summit.ty - 3) * TILE;
    // 돌 수에 따라 매번 새로 그리는 그림(돌 하나하나가 보인다)
    this.cairnTex = this.textures.exists('cairns')
      ? (this.textures.get('cairns') as Phaser.Textures.CanvasTexture)
      : this.textures.createCanvas('cairns', CAIRN_W, CAIRN_H)!;
    this.cairnBaseY = cy;
    this.cairn = this.add.image(cx, cy + 14, 'cairns').setOrigin(0.5, 1).setDepth(cy);
    this.cairnLabel = this.label(cx, cy - 20, '');
    this.refreshCairn();
    this.interactables.push({
      hit: new Phaser.Geom.Rectangle(cx - 60, cy - 70, 120, 76),
      approach: { tx: summit.tx, ty: summit.ty - 2 },
      onArrive: () => this.useCairn(),
    });

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

    // 카페
    const kx = (CAFE.x + CAFE.w / 2) * TILE;
    const ky = (CAFE.y + CAFE.h) * TILE;
    this.add.image(kx, ky + 6, 'cafe').setOrigin(0.5, 1).setDepth(ky - 1);
    this.interactables.push({
      hit: new Phaser.Geom.Rectangle(CAFE.x * TILE, (CAFE.y - 1) * TILE, CAFE.w * TILE, (CAFE.h + 1) * TILE),
      approach: CAFE.door,
      onArrive: () => {
        actions.setPosition('cafe', 7, 8);
        this.scene.start('cafe');
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
        this.refreshGathered(false);
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
    this.tool = this.add.image(0, -12, 'axe').setOrigin(0.5, 0.95).setVisible(false);
    this.player.add(this.tool);

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
      hud.toast('가고 싶은 곳을 누르면 걸어갑니다 · 길가의 나무, 바위, 물을 눌러 보세요', 6000);
    }
  }

  private label(x: number, y: number, text: string): Phaser.GameObjects.Text {
    return this.add
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

  // ── 채집(나무·바위) ─────────────────────────────────────

  /** 채집한 자리는 그루터기·돌무더기로, 시간이 지나면 원래대로 그린다. */
  private refreshGathered(initial: boolean): void {
    const map = getMap();
    const now = Date.now();
    for (const key of Object.keys(state.gathered)) {
      const [x, y] = key.split(',').map(Number);
      const rule = ruleOf(map.decor[y]?.[x] ?? -1);
      if (!rule || now - state.gathered[key] >= rule.ms) {
        actions.regrow(key);
        if (rule) this.decorLayer.putTileAt(map.decor[y][x], x, y);
      } else if (initial) {
        this.decorLayer.putTileAt(rule.left, x, y);
      }
    }
  }

  /** 누른 칸에서 반경 r 안의, 걸을 수 있는 가장 가까운 칸. */
  private standNear(tx: number, ty: number, r: number): [number, number] | null {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        if (!this.walk[ny * MAP_W + nx]) continue;
        // 대상에 가까운 칸을 우선하고, 비슷하면 지금 위치에서 가까운 칸
        const d = Math.hypot(dx, dy) * 10 + Math.hypot(nx - this.ptx, ny - this.pty) * 0.1;
        if (d < bd) {
          bd = d;
          best = [nx, ny];
        }
      }
    return best;
  }

  /** 길가의 나무·바위·물을 눌렀을 때. */
  protected tapWorld(wx: number, wy: number): boolean {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    const map = getMap();
    const rule = ruleOf(map.decor[ty][tx]);
    if (rule) {
      const at = this.standNear(tx, ty, 1);
      if (!at) return false; // 길에서 먼 것은 그냥 걷기로 처리
      this.goTo(at[0], at[1], () => this.startGather(tx, ty, rule));
      return true;
    }
    const g = map.ground[ty][tx];
    if (g === T.WATER || g === T.WATER2) {
      const at = this.standNear(tx, ty, 2);
      if (!at) return false;
      this.goTo(at[0], at[1], () => this.startFishing(tx, ty));
      return true;
    }
    return false;
  }

  private startGather(tx: number, ty: number, rule: GatherRule): void {
    const at = state.gathered[`${tx},${ty}`];
    if (at) {
      hud.toast(`${rule.wait} · ${hud.fmtRemain(rule.ms - (Date.now() - at))}`);
      return;
    }
    const dir = tx < this.ptx ? -1 : 1;
    this.sprite.setFlipX(dir < 0);
    this.tool
      .setTexture(rule.tool)
      .setVisible(true)
      .setPosition(dir * 11, -12)
      .setFlipX(dir < 0)
      .setAngle(-50 * dir);
    const tween = this.tweens.add({
      targets: this.tool,
      angle: 60 * dir,
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeIn',
    });
    const timer = this.time.delayedCall(1700, () => {
      this.stopWork();
      if (actions.gather(tx, ty, rule.item)) {
        this.decorLayer.putTileAt(rule.left, tx, ty);
        hud.refreshInventory();
        hud.toast(`${ITEMS[rule.item].emoji} ${eul(ITEMS[rule.item].name)} 얻었어요`);
      }
    });
    this.working = { timer, tween };
  }

  private stopWork(): void {
    if (!this.working) return;
    this.working.timer.remove();
    this.working.tween.stop();
    this.working = undefined;
    this.tool.setVisible(false);
  }

  // ── 낚시 ───────────────────────────────────────────────

  private startFishing(tx: number, ty: number): void {
    const bx = (tx + 0.5) * TILE;
    const by = (ty + 0.5) * TILE;
    const dir = bx < this.player.x ? -1 : 1;
    this.sprite.setFlipX(dir < 0);
    const tipX = this.player.x + dir * 20;
    const tipY = this.player.y - 44;
    const line = this.add.graphics().setDepth(9e5);
    line.lineStyle(3, 0x7a5a3a).lineBetween(this.player.x + dir * 7, this.player.y - 16, tipX, tipY);
    line.lineStyle(1, 0xffffff, 0.9).lineBetween(tipX, tipY, bx, by);
    const bobber = this.add.circle(bx, by, 4.5, 0xe0483a).setStrokeStyle(2, 0xffffff).setDepth(9e5);
    const mark = this.add
      .text(this.player.x, this.player.y - 50, '!', {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffe066',
        stroke: '#3b2f22',
        strokeThickness: 5,
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(1e6)
      .setVisible(false);
    this.fishing = { phase: 'wait', bobber, line, mark, timer: this.waitForBite() };
    hud.toast('찌가 흔들리면 화면을 누르세요 · 그 전에 누르면 낚싯대를 거둡니다', 4000);
  }

  private waitForBite(): Phaser.Time.TimerEvent {
    return this.time.delayedCall(Phaser.Math.Between(2500, 7000), () => this.bite());
  }

  private bite(): void {
    const f = this.fishing;
    if (!f) return;
    f.phase = 'bite';
    f.mark.setVisible(true);
    f.tween = this.tweens.add({ targets: f.bobber, y: f.bobber.y + 4, duration: 110, yoyo: true, repeat: -1 });
    f.timer = this.time.delayedCall(1500, () => {
      hud.toast('놓쳤어요. 다시 기다립니다');
      this.calm();
    });
  }

  /** 입질이 끝나고 다시 기다리는 상태로. */
  private calm(): void {
    const f = this.fishing;
    if (!f) return;
    f.tween?.stop();
    f.tween = undefined;
    f.bobber.y = Math.round(f.bobber.y / TILE - 0.5) * TILE + TILE / 2;
    f.mark.setVisible(false);
    f.phase = 'wait';
    f.timer.remove();
    f.timer = this.waitForBite();
  }

  private stopFishing(): void {
    const f = this.fishing;
    if (!f) return;
    f.timer.remove();
    f.tween?.stop();
    f.bobber.destroy();
    f.line.destroy();
    f.mark.destroy();
    this.fishing = undefined;
  }

  protected tapIntercept(): boolean {
    const f = this.fishing;
    if (!f) return false;
    if (f.phase === 'bite') {
      const fish = actions.catchFish();
      hud.refreshInventory();
      hud.toast(`${ITEMS[fish].emoji} ${eul(ITEMS[fish].name)} 낚았어요`);
      this.calm();
    } else {
      this.stopFishing();
      hud.toast('낚싯대를 거뒀어요');
    }
    return true;
  }

  protected onLeave(): void {
    this.stopWork();
    this.stopFishing();
  }

  // ── 돌탑 ───────────────────────────────────────────────

  private refreshCairn(): void {
    const h = drawCairn(this.cairnTex.getContext(), state.cairn);
    this.cairnTex.refresh();
    this.cairnLabel
      .setText(state.cairn > 0 ? `${cairnName(state.cairn)} · 돌 ${state.cairn}개` : cairnName(0))
      .setY(this.cairnBaseY - Math.max(18, h + 10));
  }

  private useCairn(): void {
    const before = cairnName(state.cairn);
    if (actions.placeStone()) {
      this.refreshCairn();
      hud.refreshInventory();
      this.tweens.add({ targets: this.cairn, scaleY: 0.97, duration: 90, yoyo: true });
      hud.toast(
        cairnName(state.cairn) !== before && state.cairn > 1
          ? `${cairnName(state.cairn)}이 되었어요 · 지금까지 돌 ${state.cairn}개`
          : state.cairn > CAIRN_CAP
            ? `돌을 하나 얹었어요 · 지금까지 ${state.cairn}개 (탑은 더 커지지 않아요)`
            : `돌을 하나 올렸어요 · 지금까지 ${state.cairn}개`,
      );
    } else if (count('stone') <= 0) {
      hud.toast(
        state.cairn > 0
          ? `돌 ${state.cairn}개가 쌓인 돌탑 · 올릴 돌이 없어요`
          : '돌탑을 쌓을 자리예요. 길가 바위를 캐서 돌을 가져오세요',
      );
    }
  }

  // ── 텃밭 ───────────────────────────────────────────────

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
      const yard = p.id === 'pension' ? YARD : p.id === 'cafe' ? CAFE_YARD : null;
      const near = yard
        ? tx >= yard.x0 && tx <= yard.x1 && ty >= yard.y0 && ty <= yard.y1
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
