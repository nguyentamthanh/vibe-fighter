import * as Phaser from 'phaser';

import { STAGE_DEFINITIONS } from './stageConfig';

/** Arcade display font (loaded by index.html from Google Fonts), with a fallback while offline. */
export const DISPLAY_FONT = '"Press Start 2P", monospace';

const EMBER_TEXTURE = 'menu-ember';
const GLOW_TEXTURE = 'menu-glow';

/**
 * Calls back once the display font is ready (or after a short timeout, so an
 * offline start still reaches the menu). Canvas text measures its size when it
 * is created, so menus must not draw before the font has loaded.
 * @param callback - Runs exactly once.
 */
export function whenDisplayFontReady(callback: () => void): void {
  let done = false;
  const finish = (): void => {
    if (!done) {
      done = true;
      callback();
    }
  };

  window.setTimeout(finish, 2500);

  if (!('fonts' in document)) {
    finish();
    return;
  }

  document.fonts.load('16px "Press Start 2P"').then(finish, finish);
}

export interface MenuBackdropOptions {
  /** Opacity of the dark layer over the stage art (0 = full art, 1 = black). */
  dim?: number;
  /** Rising fire embers. */
  embers?: boolean;
  /** Slow horizontal drift of the stage art. */
  drift?: boolean;
}

/**
 * Draws the shared menu background behind everything else: the twilight
 * rooftop stage art (cover-fit, slowly drifting), dark gradients at the top and
 * bottom so text stays readable, and rising embers.
 * @param scene - The menu scene.
 * @param options - Dim level and which effects to add.
 */
export function createMenuBackdrop(scene: Phaser.Scene, options: MenuBackdropOptions = {}): void {
  const { dim = 0.55, embers = true, drift = true } = options;
  const { width, height } = scene.cameras.main;
  const stage = STAGE_DEFINITIONS[0];

  if (scene.textures.exists(stage.key)) {
    const art = scene.add.image(width / 2, height / 2, stage.key).setDepth(-100);
    art.setScale(Math.max(width / art.width, height / art.height) * 1.12);

    if (drift) {
      const slack = Math.min((art.displayWidth - width) / 2, width * 0.2);
      scene.tweens.add({
        targets: art,
        x: { from: width / 2 + slack, to: width / 2 - slack },
        duration: 24000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
    }
  }

  const shade = scene.add.graphics().setDepth(-90);
  shade.fillStyle(0x020617, dim);
  shade.fillRect(0, 0, width, height);
  shade.fillGradientStyle(0x020617, 0x020617, 0x020617, 0x020617, 0.85, 0.85, 0, 0);
  shade.fillRect(0, 0, width, height * 0.32);
  shade.fillGradientStyle(0x020617, 0x020617, 0x020617, 0x020617, 0, 0, 0.9, 0.9);
  shade.fillRect(0, height * 0.7, width, height * 0.3);

  if (embers) {
    createEmbers(scene, width, height);
  }
}

/**
 * Soft additive orange light (a radial gradient texture), used behind the logo.
 * @param scene - The owning scene.
 * @returns The texture key.
 */
export function ensureGlowTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists(GLOW_TEXTURE)) {
    const size = 256;
    const canvas = scene.textures.createCanvas(GLOW_TEXTURE, size, size);
    const context = canvas?.getContext();

    if (canvas && context) {
      const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255, 170, 60, 0.9)');
      gradient.addColorStop(0.45, 'rgba(249, 115, 22, 0.35)');
      gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
      canvas.refresh();
    }
  }

  return GLOW_TEXTURE;
}

function createEmbers(scene: Phaser.Scene, width: number, height: number): void {
  if (!scene.textures.exists(EMBER_TEXTURE)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture(EMBER_TEXTURE, 8, 8);
    graphics.destroy();
  }

  const emitter = scene.add
    .particles(0, 0, EMBER_TEXTURE, {
      x: { min: 0, max: width },
      y: height + 10,
      lifespan: { min: 3500, max: 7500 },
      speedY: { min: -95, max: -35 },
      speedX: { min: -25, max: 25 },
      scale: { start: 0.75, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xfb923c, 0xf97316, 0xfacc15, 0xef4444],
      blendMode: 'ADD',
      frequency: Math.round(90 * (1280 / Math.max(width, 1))),
      quantity: 1
    })
    .setDepth(-80);

  // Start with the screen already full of embers instead of an empty first few seconds.
  emitter.fastForward(6000);
}
