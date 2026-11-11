import Phaser from 'phaser';
import { PEN, TILE } from './mapgen';
import { isPenFed } from './state';

/**
 * 펜션 앞 우리와 그 안의 닭·토끼.
 * 동물의 위치와 움직임은 화면 장식이라 저장하지 않는다(들어올 때마다 새로 놓임).
 * 저장되는 것은 "먹이를 준 효과가 끝나는 시각" 하나뿐이다.
 */

type Kind = 'chicken' | 'rabbit';

interface Animal {
  kind: Kind;
  box: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  phase: 'idle' | 'walk' | 'eat';
  /** 지금 단계가 끝날 때까지 남은 시간(ms) */
  left: number;
  gx: number;
  gy: number;
  /** 걸음·뜀 박자 */
  beat: number;
  toFood: boolean;
}

const X0 = PEN.x0 * TILE;
const Y0 = PEN.y0 * TILE;
const W = (PEN.x1 - PEN.x0 + 1) * TILE;
const H = (PEN.y1 - PEN.y0 + 1) * TILE;
/** 동물이 돌아다니는 범위(울타리 안쪽) */
const AREA = new Phaser.Geom.Rectangle(X0 + 14, Y0 + 12, W - 28, H - 26);

export class Pen {
  private animals: Animal[] = [];
  private food?: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene) {
    scene.add.image(X0 - 6, Y0 - 18, 'pen_back').setOrigin(0).setDepth(Y0 - 1);
    scene.add.image(X0 - 6, Y0 + H - 18, 'pen_front').setOrigin(0).setDepth(Y0 + H + 2);
    const kinds: [Kind, string][] = [
      ['chicken', 'chicken_w'],
      ['chicken', 'chicken_b'],
      ['chicken', 'chicken_w'],
      ['rabbit', 'rabbit_w'],
      ['rabbit', 'rabbit_b'],
      ['rabbit', 'rabbit_g'],
    ];
    for (const [kind, tex] of kinds) {
      const x = Phaser.Math.Between(AREA.left, AREA.right);
      const y = Phaser.Math.Between(AREA.top, AREA.bottom);
      const shadow = scene.add.image(0, 1, 'shadow').setScale(0.6);
      const body = scene.add.image(0, 0, tex).setOrigin(0.5, 0.95);
      const box = scene.add.container(x, y, [shadow, body]).setDepth(y);
      this.animals.push({ kind, box, body, phase: 'idle', left: Phaser.Math.Between(200, 2500), gx: x, gy: y, beat: 0, toFood: false });
    }
  }

  /** 우리 안쪽으로 눌린 위치를 보정한다. */
  clamp(x: number, y: number): [number, number] {
    return [Phaser.Math.Clamp(x, AREA.left + 6, AREA.right - 6), Phaser.Math.Clamp(y, AREA.top + 6, AREA.bottom - 4)];
  }

  /** (fromX, fromY) 에서 당근을 던진다. 떨어지면 동물들이 모여들어 먹는다. */
  feed(fromX: number, fromY: number, toX: number, toY: number): void {
    this.food?.destroy();
    const food = this.scene.add.image(fromX, fromY - 20, 'carrot_bit').setDepth(1e5);
    this.food = food;
    this.scene.tweens.add({ targets: food, x: toX, duration: 420, ease: 'Linear' });
    this.scene.tweens.add({
      targets: food,
      y: toY,
      duration: 420,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (this.food !== food) return;
        food.setDepth(toY - 1);
        this.animals.forEach((a, i) => {
          const ang = (i / this.animals.length) * Math.PI * 2;
          const [gx, gy] = this.clamp(toX + Math.cos(ang) * 17, toY + Math.sin(ang) * 11);
          a.phase = 'walk';
          a.gx = gx;
          a.gy = gy;
          a.toFood = true;
        });
        this.scene.time.delayedCall(4200, () => {
          if (this.food === food) {
            food.destroy();
            this.food = undefined;
          }
        });
      },
    });
  }

  private heart(a: Animal): void {
    const t = this.scene.add
      .text(a.box.x, a.box.y - 22, '♥', { fontSize: '15px', color: '#e2473b', stroke: '#ffffff', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(1e6);
    this.scene.tweens.add({ targets: t, y: t.y - 20, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  update(delta: number): void {
    const lively = isPenFed();
    for (const a of this.animals) {
      const rabbit = a.kind === 'rabbit';
      a.left -= delta;
      if (a.phase === 'walk') {
        const speed = (rabbit ? 46 : 30) * (lively || a.toFood ? 1.7 : 1);
        const dx = a.gx - a.box.x;
        const dy = a.gy - a.box.y;
        const dist = Math.hypot(dx, dy);
        const step = (speed * delta) / 1000;
        if (Math.abs(dx) > 0.5) a.body.setFlipX(dx < 0);
        if (dist <= step) {
          a.box.setPosition(a.gx, a.gy);
          a.body.y = 0;
          if (a.toFood) {
            a.toFood = false;
            a.phase = 'eat';
            a.left = 2600;
            this.heart(a);
          } else {
            a.phase = 'idle';
            a.left = lively ? Phaser.Math.Between(150, 900) : Phaser.Math.Between(900, 4200);
          }
        } else {
          a.box.x += (dx / dist) * step;
          a.box.y += (dy / dist) * step;
          a.beat += delta;
          // 토끼는 깡충깡충, 닭은 종종걸음
          a.body.y = -Math.abs(Math.sin(a.beat / (rabbit ? 130 : 70))) * (rabbit ? (lively ? 9 : 6) : 2);
        }
        a.box.setDepth(a.box.y);
      } else if (a.phase === 'eat') {
        a.beat += delta;
        a.body.setAngle(Math.sin(a.beat / 90) > 0 ? (a.body.flipX ? -18 : 18) : 0);
        if (a.left <= 0) {
          a.body.setAngle(0);
          a.phase = 'idle';
          a.left = 300;
        }
      } else {
        // 가만히 있을 때 닭은 가끔 모이를 쫀다
        if (!rabbit) {
          a.beat += delta;
          const peck = Math.sin(a.beat / 1100) > 0.92 && Math.sin(a.beat / 80) > 0;
          a.body.setAngle(peck ? (a.body.flipX ? -22 : 22) : 0);
        }
        if (a.left <= 0) {
          a.body.setAngle(0);
          const far = lively ? 90 : 60;
          const [gx, gy] = this.clamp(
            a.box.x + Phaser.Math.Between(-far, far),
            a.box.y + Phaser.Math.Between(-far * 0.6, far * 0.6),
          );
          a.gx = gx;
          a.gy = gy;
          a.phase = 'walk';
        }
      }
    }
  }
}
