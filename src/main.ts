import Phaser from 'phaser';
import { buildTextures } from './art';
import { MountainScene } from './MountainScene';
import { PensionScene } from './PensionScene';
import { CafeScene } from './CafeScene';
import { actions, FULL_MS, state } from './state';
import { ITEMS, RECIPES } from './items';
import * as hud from './hud';
import { initHud } from './hud';

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  create(): void {
    buildTextures(this);
    this.scene.start(['pension', 'cafe'].includes(state.player.scene) ? state.player.scene : 'mountain');
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#6aa35c',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { roundPixels: true, antialias: true },
  scene: [BootScene, MountainScene, PensionScene, CafeScene],
});

(window as unknown as { __game: Phaser.Game }).__game = game;

// 가방 안 요리 옆에 '먹기' 버튼을 붙인다.
hud.setBagButton('dish', '먹기', (id) => {
  if (!actions.eat(id)) return;
  hud.refreshInventory();
  hud.refreshBuff();
  hud.toast(`${ITEMS[id].emoji} ${ITEMS[id].name} 잘 먹었습니다 · ${FULL_MS / 60_000}분 동안 걸음이 빨라져요`, 3200);
});
hud.setBagNote(() => `요리 도감 ${state.cookbook.length}/${RECIPES.length}`);

initHud(() => {
  const m = game.scene.getScene('mountain') as MountainScene;
  if (game.scene.isActive('mountain')) m.redrawMinimap();
});
