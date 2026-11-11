import Phaser from 'phaser';
import { RoomScene } from './RoomScene';
import { PENSION } from './mapgen';
import { ROOM_H, ROOM_W } from './art';
import { actions, count, state } from './state';
import { eul, ITEMS } from './items';
import * as hud from './hud';

/** 펜션 실내. 왼쪽은 거실(침대·벽난로·방석), 오른쪽은 주방(화덕에서 요리). */
export class PensionScene extends RoomScene {
  private fire!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;

  constructor() {
    super({
      id: 'pension',
      name: '펜션 안',
      texture: 'room',
      w: ROOM_W,
      h: ROOM_H,
      floor: { x0: 1, y0: 2, x1: 14, y1: 7 },
      blocked: [
        [1, 2], [2, 2], [1, 3], [2, 3], // 침대
        [8, 3], [9, 3], // 탁자
        [11, 2], [12, 2], [13, 2], [14, 2], // 조리대
      ],
      start: { tx: 6, ty: 7 },
      exitTo: PENSION.door,
      hint: '침대·방석에서 쉬고, 벽난로에 장작을 넣고, 주방 화덕에서 요리해요',
    });
  }

  protected setup(): void {
    this.glow = this.add.image(168, 70, 'glow').setDepth(-9).setBlendMode(Phaser.BlendModes.ADD);
    this.fire = this.add.image(168, 60, 'fire').setOrigin(0.5, 1).setDepth(-8);
    this.tweens.add({ targets: this.fire, scaleY: 1.18, scaleX: 0.92, duration: 220, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: this.glow, alpha: 0.75, duration: 700, yoyo: true, repeat: -1 });
    this.refreshFire();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshFire() });

    this.interactables.push(
      { hit: this.rect(1, 2, 2, 2), approach: { tx: 3, ty: 3 }, onArrive: () => this.sleep() },
      { hit: this.rect(8, 5, 1, 1), approach: { tx: 8, ty: 5 }, onArrive: () => this.sitDown('방석에 앉아 잠깐 쉽니다') },
      {
        hit: new Phaser.Geom.Rectangle(132, 8, 72, 60),
        approach: { tx: 4, ty: 2 },
        onArrive: () => this.feedFire(),
      },
      {
        hit: new Phaser.Geom.Rectangle(352, 8, 128, 88),
        approach: { tx: 12, ty: 3 },
        onArrive: () => hud.showRecipes((i) => this.cook(i)),
      },
    );
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

  private cook(index: number): void {
    if (count('wood') < 1) {
      hud.toast('화덕에 넣을 장작이 없어요');
      return;
    }
    this.busy = true;
    this.sprite.setFlipX(false);
    hud.toast('지글지글…', 1400);
    const bob = this.tweens.add({ targets: this.sprite, y: -3, duration: 160, yoyo: true, repeat: 4 });
    this.time.delayedCall(1500, () => {
      bob.stop();
      this.sprite.y = 0;
      this.busy = false;
      const made = actions.cook(index);
      if (!made) return;
      hud.refreshInventory();
      const name = ITEMS[made.dish].name;
      hud.toast(`${ITEMS[made.dish].emoji} ${eul(name)} 만들었어요${made.isNew ? ' · 요리 도감에 기록' : ''}`, 3200);
    });
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
