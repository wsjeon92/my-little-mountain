import Phaser from 'phaser';
import { RoomScene } from './RoomScene';
import { CAFE } from './mapgen';
import { CAFE_H, CAFE_W } from './art';
import { eul } from './items';
import * as hud from './hud';

const MENU = [
  { emoji: '☕', name: '아메리카노' },
  { emoji: '🍵', name: '유자차' },
  { emoji: '🍫', name: '핫초코' },
];

/** 카페 실내. 계산대에서 주문하면 공짜로 나오고, 창가나 탁자에 앉아 마신다. */
export class CafeScene extends RoomScene {
  private drink?: { emoji: string; name: string };
  private cup!: Phaser.GameObjects.Text;

  constructor() {
    super({
      id: 'cafe',
      name: '산마루 카페',
      texture: 'caferoom',
      w: CAFE_W,
      h: CAFE_H,
      floor: { x0: 1, y0: 2, x1: 12, y1: 8 },
      blocked: [
        [1, 2], [2, 2], [3, 2], [4, 2], // 계산대
        [5, 5], [10, 5], // 둥근 탁자
        [12, 7], // 화분
      ],
      start: { tx: 7, ty: 8 },
      exitTo: CAFE.door,
      hint: '계산대에서 주문하고, 창가나 탁자에 앉아 쉬어요',
    });
  }

  protected setup(): void {
    this.drink = undefined;
    this.cup = this.add.text(11, -26, '', { fontSize: '15px' }).setOrigin(0.5, 1);
    this.player.add(this.cup);

    this.interactables.push({
      hit: new Phaser.Geom.Rectangle(32, 8, 128, 88),
      approach: { tx: 3, ty: 3 },
      onArrive: () =>
        hud.showChoices(
          '무엇을 드릴까요?',
          MENU.map((m) => ({ ...m, small: '무료' })),
          (i) => this.order(i),
        ),
    });
    // 창가 의자 4개, 탁자 의자 4개
    for (const x of [6, 8, 10, 12]) this.seat(x, 2, '창가에 앉아', '산을 바라봅니다');
    for (const x of [4, 6, 9, 11]) this.seat(x, 5, '자리에 앉아', '잠깐 쉽니다');
  }

  private seat(tx: number, ty: number, where: string, idle: string): void {
    this.interactables.push({
      hit: this.rect(tx, ty, 1, 1),
      approach: { tx, ty },
      onArrive: () => this.sitDown(this.drink ? `${where} ${eul(this.drink.name)} 마십니다` : `${where} ${idle}`),
    });
  }

  private order(i: number): void {
    const m = MENU[i];
    this.busy = true;
    hud.toast(`${m.name} 한 잔 준비 중…`, 1300);
    this.time.delayedCall(1400, () => {
      this.busy = false;
      this.drink = m;
      this.cup.setText(m.emoji);
      hud.toast(`${m.emoji} 주문하신 ${m.name} 나왔습니다 · 자리에 앉아 드세요`, 3200);
    });
  }
}
