import Phaser from 'phaser';
import { buildTextures } from './art';
import { MountainScene } from './MountainScene';
import { InteriorScene } from './InteriorScene';
import { state } from './state';
import { initHud } from './hud';

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  create(): void {
    buildTextures(this);
    this.scene.start(state.player.scene === 'pension' ? 'pension' : 'mountain');
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#6aa35c',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { roundPixels: true, antialias: true },
  scene: [BootScene, MountainScene, InteriorScene],
});

(window as unknown as { __game: Phaser.Game }).__game = game;

initHud(() => {
  const m = game.scene.getScene('mountain') as MountainScene;
  if (game.scene.isActive('mountain')) m.redrawMinimap();
});
