import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { FarmScene } from './scenes/FarmScene';
import { EffectsScene } from './scenes/EffectsScene';

export function createAvoraFarmGame(parentContainerId: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: parentContainerId,
    width: '100%',
    height: '100%',
    transparent: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: false,
    },
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      roundPixels: false,
      mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
    },
    input: {
      activePointers: 3,
    },
    audio: {
      noAudio: true,
    },
    scene: [BootScene, PreloadScene, FarmScene, EffectsScene],
  };

  return new Phaser.Game(config);
}
