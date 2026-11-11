import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { TILE } from './mapgen';
import { actions, state, type SceneId } from './state';
import * as hud from './hud';

export interface RoomDef {
  id: SceneId;
  name: string;
  texture: string;
  w: number;
  h: number;
  /** 걸을 수 있는 범위(칸)와 그 안에서 막힌 칸(가구) */
  floor: { x0: number; y0: number; x1: number; y1: number };
  blocked: [number, number][];
  /** 들어왔을 때 서는 칸. 문은 그 바로 아래 칸이다. */
  start: { tx: number; ty: number };
  /** 나가면 서게 되는 산 위의 칸 */
  exitTo: { tx: number; ty: number };
  hint: string;
}

/** 실내 지도(펜션, 카페)의 공통 동작. 가구별 기능은 setup() 에서 붙인다. */
export abstract class RoomScene extends BaseScene {
  constructor(protected def: RoomDef) {
    super(def.id);
  }

  protected abstract setup(): void;

  protected rect(x: number, y: number, w: number, h: number): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(x * TILE, y * TILE, w * TILE, h * TILE);
  }

  create(): void {
    const d = this.def;
    const walk = new Uint8Array(d.w * d.h);
    for (let y = d.floor.y0; y <= d.floor.y1; y++) for (let x = d.floor.x0; x <= d.floor.x1; x++) walk[y * d.w + x] = 1;
    for (const [x, y] of d.blocked) walk[y * d.w + x] = 0;
    this.initGrid(d.w, d.h, walk);
    this.speed = 120;

    const cam = this.cameras.main;
    cam.setBackgroundColor('#2a2018');
    this.add.image(0, 0, d.texture).setOrigin(0).setDepth(-10);

    let { tx, ty } = state.player;
    if (state.player.scene !== d.id || !walk[ty * d.w + tx]) {
      tx = d.start.tx;
      ty = d.start.ty;
    }
    this.createPlayer(tx, ty);

    this.interactables.push({
      hit: this.rect(d.start.tx, d.start.ty + 1, 1, 1),
      approach: d.start,
      onArrive: () => {
        actions.setPosition('mountain', d.exitTo.tx, d.exitTo.ty);
        this.scene.start('mountain');
      },
    });
    this.setup();

    const fit = () => {
      const z = Math.min(this.scale.width / (d.w * TILE + 24), this.scale.height / (d.h * TILE + 140));
      this.minZoom = Math.min(1, z);
      this.maxZoom = 3;
      cam.setZoom(Phaser.Math.Clamp(z, 0.6, 2.4));
      cam.centerOn((d.w * TILE) / 2, (d.h * TILE) / 2);
    };
    fit();
    this.scale.on('resize', fit);
    this.events.once('shutdown', () => this.scale.off('resize', fit));

    this.setupInput();
    hud.setMapButtonVisible(false);
    hud.setPlace(d.name);
    hud.toast(d.hint, 3600);
    cam.fadeIn(300, 42, 32, 24);
  }

  protected onStep(tx: number, ty: number): void {
    actions.setPosition(this.def.id, tx, ty);
  }

  protected sitDown(msg: string): void {
    this.sprite.setTexture('player_sit');
    hud.toast(msg);
  }
}
