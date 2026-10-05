import { preloadStarterAssets, registerStarterAnimations } from '../game/assets';
import { registerGeneratedAssets } from '../game/generatedAssets';
import { registerTileAtlasFrames } from '../game/tileAtlas';
import { registerQuestUiAtlasFrames } from '../game/uiAtlas';
import { registerFightingUiAtlasFrames } from '../game/fightingUiAtlas';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

export class BootScene extends BaseScene {
  constructor() {
    super(SCENE_KEYS.Boot);
  }

  preload(): void {
    preloadStarterAssets(this);
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.Boot);
    registerGeneratedAssets(this);
    registerTileAtlasFrames(this);
    registerQuestUiAtlasFrames(this);
    registerFightingUiAtlasFrames(this);
    registerStarterAnimations(this);
    // The game page goes straight to the menu; the dashboard keeps the "press any key" splash.
    this.scene.start(this.app.isDebugShell ? SCENE_KEYS.Splash : SCENE_KEYS.MainMenu);
  }
}
