import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { PENSION, TILE } from './mapgen';
import { ROOM_H, ROOM_W } from './art';
import { actions, state } from './state';
import * as hud from './hud';

/** 펜션 실내. 침대에서 자고, 방석에 앉고, 문으로 나간다. */
export class InteriorScene extends BaseScene {
  private fire!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;

  constructor() {
    super('pension');
  }

  create(): void {
    const walk = new Uint8Array(ROOM_W * ROOM_H);
    for (let y = 2; y <= 7; y++) for (let x = 1; x <= 10; x++) walk[y * ROOM_W + x] = 1;
    for (const [x, y] of [[1, 2], [2, 2], [1, 3], [2, 3], [8, 3], [9, 3]]) walk[y * ROOM_W + x] = 0;
    this.initGrid(ROOM_W, ROOM_H, walk);
    this.speed = 120;

    const cam = this.cameras.main;
    cam.setBackgroundColor('#2a2018');
    this.add.image(0, 0, 'room').setOrigin(0).setDepth(-10);
    this.glow = this.add.image(168, 70, 'glow').setDepth(-9).setBlendMode(Phaser.BlendModes.ADD);
    this.fire = this.add.image(168, 60, 'fire').setOrigin(0.5, 1).setDepth(-8);
    this.tweens.add({ targets: this.fire, scaleY: 1.18, scaleX: 0.92, duration: 220, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: this.glow, alpha: 0.75, duration: 700, yoyo: true, repeat: -1 });
    this.refreshFire();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshFire() });

    let { tx, ty } = state.player;
    if (state.player.scene !== 'pension' || !walk[ty * ROOM_W + tx]) {
      tx = 6;
      ty = 7;
    }
    this.createPlayer(tx, ty);

    const rect = (x: number, y: number, w: number, h: number) =>
      new Phaser.Geom.Rectangle(x * TILE, y * TILE, w * TILE, h * TILE);
    this.interactables.push(
      { hit: rect(1, 2, 2, 2), approach: { tx: 3, ty: 3 }, onArrive: () => this.sleep() },
      { hit: rect(8, 5, 1, 1), approach: { tx: 8, ty: 5 }, onArrive: () => this.sit() },
      {
        hit: new Phaser.Geom.Rectangle(132, 8, 72, 60),
        approach: { tx: 4, ty: 2 },
        onArrive: () => this.feedFire(),
      },
      {
        hit: rect(6, 8, 1, 1),
        approach: { tx: 6, ty: 7 },
        onArrive: () => {
          actions.setPosition('mountain', PENSION.door.tx, PENSION.door.ty);
          this.scene.start('mountain');
        },
      },
    );

    const fit = () => {
      const z = Math.min(this.scale.width / (ROOM_W * TILE + 24), this.scale.height / (ROOM_H * TILE + 140));
      this.minZoom = Math.min(1, z);
      this.maxZoom = 3;
      cam.setZoom(Phaser.Math.Clamp(z, 0.6, 2.4));
      cam.centerOn((ROOM_W * TILE) / 2, (ROOM_H * TILE) / 2);
    };
    fit();
    this.scale.on('resize', fit);
    this.events.once('shutdown', () => this.scale.off('resize', fit));

    this.setupInput();
    hud.setMapButtonVisible(false);
    hud.setPlace('펜션 안');
    hud.toast('침대나 방석에서 쉬고, 벽난로에 장작을 넣을 수 있어요');
    cam.fadeIn(300, 42, 32, 24);
  }

  protected onStep(tx: number, ty: number): void {
    actions.setPosition('pension', tx, ty);
  }

  private refreshFire(): void {
    const on = state.fireUntil > Date.now();
    this.fire.setVisible(on);
    this.glow.setVisible(on);
  }

  private feedFire(): void {
    if (actions.addFirewood()) {
      hud.refreshInventory();
      this.refreshFire();
      hud.toast(`장작을 넣었어요 · 불이 ${hud.fmtRemain(state.fireUntil - Date.now())} 동안 탑니다`);
    } else if (state.fireUntil > Date.now()) {
      hud.toast(`불이 ${hud.fmtRemain(state.fireUntil - Date.now())} 더 탑니다 · 넣을 장작이 없어요`);
    } else {
      hud.toast('장작이 없어요. 등산로 옆 나무를 베어 오세요');
    }
  }

  private sit(): void {
    this.sprite.setTexture('player_sit');
    hud.toast('방석에 앉아 잠깐 쉽니다');
  }

  private sleep(): void {
    this.busy = true;
    const cam = this.cameras.main;
    cam.fadeOut(700, 20, 16, 12);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.time.delayedCall(1100, () => {
        cam.fadeIn(900, 20, 16, 12);
        hud.toast('푹 자고 일어났어요');
        this.busy = false;
      });
    });
  }
}
