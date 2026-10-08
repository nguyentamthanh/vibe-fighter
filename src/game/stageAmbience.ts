import * as Phaser from 'phaser';

import type { StageAmbienceKind } from './stageConfig';

/** Depth of ambience drawn behind the fighters (fighters sit at 5 and 8). */
const BACK_DEPTH = 2;
/** Depth of ambience drawn in front of the fighters, still under the HUD (100). */
const FRONT_DEPTH = 9;

const TEXTURE_KEYS = {
  petal: 'ambience-petal',
  drop: 'ambience-raindrop',
  ember: 'ambience-ember',
  mist: 'ambience-mist'
} as const;

/**
 * Brings a static stage painting to life with procedural layers (no extra art):
 * falling petals, drifting mist and sky clouds, rain with lightning, rising embers, flickering
 * neon. Everything is screen-space (scroll factor 0, or a slow parallax for the
 * mist), so it covers the view wherever the camera scrolls. Objects belong to
 * the scene and are destroyed with it.
 * @param scene - The match scene.
 * @param kinds - The layers this stage asks for.
 * @param groundY - The fighters' ground line in screen pixels (mist and embers sit around it).
 */
export function createStageAmbience(scene: Phaser.Scene, kinds: StageAmbienceKind[], groundY: number): void {
  ensureTextures(scene);
  const { width, height } = scene.cameras.main;

  kinds.forEach((kind) => {
    switch (kind) {
      case 'petals':
        addPetals(scene, width);
        break;
      case 'mist':
        addMist(scene, width, groundY);
        break;
      case 'clouds':
        addClouds(scene, width, height);
        break;
      case 'rain':
        addRain(scene, width, height);
        break;
      case 'embers':
        addEmbers(scene, width, height, groundY);
        break;
      case 'neon':
        addNeonFlicker(scene, width, height);
        break;
    }
  });
}

/** Pink blossom petals drifting down and sideways, a few of them in front of the fighters. */
function addPetals(scene: Phaser.Scene, width: number): void {
  const config = (depthScale: number): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig => ({
    x: { min: -40, max: width + 120 },
    y: -20,
    lifespan: { min: 7000, max: 11000 },
    speedX: { min: -70, max: -10 },
    speedY: { min: 45, max: 90 },
    rotate: { start: 0, end: 360, random: true },
    scale: { min: 0.8 * depthScale, max: 1.5 * depthScale },
    alpha: { start: 0.95, end: 0.6 },
    tint: [0xfbcfe8, 0xf9a8d4, 0xfce7f3],
    frequency: depthScale > 1 ? 900 : 260,
    advance: 9000,
    maxAliveParticles: depthScale > 1 ? 10 : 45
  });

  scene.add.particles(0, 0, TEXTURE_KEYS.petal, config(1)).setScrollFactor(0).setDepth(BACK_DEPTH);
  scene.add.particles(0, 0, TEXTURE_KEYS.petal, config(1.8)).setScrollFactor(0).setDepth(FRONT_DEPTH);
}

/** Soft mist banks sliding slowly along the horizon behind the fighters. */
function addMist(scene: Phaser.Scene, width: number, groundY: number): void {
  for (let i = 0; i < 5; i++) {
    addDriftingWisp(scene, width, groundY - 150 - (i % 3) * 45, {
      alpha: 0.26 + (i % 2) * 0.12,
      scaleX: 1.6 + (i % 3) * 0.5,
      scaleY: 1 + (i % 2) * 0.4,
      speed: 14 + i * 5,
      tint: 0xffffff
    });
  }
}

/** Long cloud wisps crossing the upper sky at different speeds (a slow parallax). */
function addClouds(scene: Phaser.Scene, width: number, height: number): void {
  for (let i = 0; i < 6; i++) {
    addDriftingWisp(scene, width, height * (0.08 + (i % 3) * 0.09), {
      alpha: 0.45 + (i % 2) * 0.15,
      scaleX: 2.2 + (i % 3) * 0.6,
      scaleY: 0.45 + (i % 2) * 0.2,
      speed: 10 + i * 4,
      tint: 0xfff7e0
    });
  }
}

interface WispStyle {
  alpha: number;
  scaleX: number;
  scaleY: number;
  /** Pixels per second. */
  speed: number;
  tint: number;
}

/** One soft white wisp that drifts left to right forever, starting at a random x. */
function addDriftingWisp(scene: Phaser.Scene, width: number, y: number, style: WispStyle): void {
  const wisp = scene.add
    .image(Phaser.Math.Between(-200, width), y, TEXTURE_KEYS.mist)
    .setScrollFactor(0.35, 0)
    .setDepth(1)
    .setAlpha(style.alpha)
    .setTint(style.tint)
    .setScale(style.scaleX, style.scaleY);
  const offscreen = 160 * style.scaleX + 40;
  const travel = (): void => {
    scene.tweens.add({
      targets: wisp,
      x: width + offscreen,
      duration: ((width + offscreen - wisp.x) / style.speed) * 1000,
      onComplete: () => {
        wisp.x = -offscreen;
        travel();
      }
    });
  };
  travel();
}

/** Slanted rain in two layers plus an occasional lightning flash. */
function addRain(scene: Phaser.Scene, width: number, height: number): void {
  const config = (front: boolean): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig => ({
    x: { min: -100, max: width + 200 },
    y: -30,
    lifespan: 1400,
    speedX: front ? -260 : -180,
    speedY: front ? 1100 : 800,
    rotate: 13,
    scale: front ? { min: 1, max: 1.4 } : { min: 0.6, max: 0.9 },
    alpha: front ? 0.55 : 0.35,
    frequency: front ? 25 : 12,
    quantity: 2,
    advance: 1500
  });

  scene.add.particles(0, 0, TEXTURE_KEYS.drop, config(false)).setScrollFactor(0).setDepth(BACK_DEPTH);
  scene.add.particles(0, 0, TEXTURE_KEYS.drop, config(true)).setScrollFactor(0).setDepth(FRONT_DEPTH);

  const flash = scene.add
    .rectangle(0, 0, width, height, 0xdbeafe, 0)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(BACK_DEPTH + 1);
  const strike = (): void => {
    scene.tweens.chain({
      targets: flash,
      tweens: [
        { alpha: 0.32, duration: 60 },
        { alpha: 0.05, duration: 90 },
        { alpha: 0.24, duration: 50 },
        { alpha: 0, duration: 420 }
      ]
    });
    scene.time.delayedCall(Phaser.Math.Between(6000, 13000), strike);
  };
  scene.time.delayedCall(Phaser.Math.Between(3000, 7000), strike);
}

/** Glowing embers rising from below the floor with a warm, flickering light wash. */
function addEmbers(scene: Phaser.Scene, width: number, height: number, groundY: number): void {
  const config = (front: boolean): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig => ({
    x: { min: 0, max: width },
    y: { min: groundY - 40, max: height },
    lifespan: { min: 2500, max: 5000 },
    speedX: { min: -25, max: 25 },
    speedY: { min: -110, max: -50 },
    scale: front ? { start: 1.4, end: 0.2 } : { start: 1, end: 0.1 },
    alpha: { start: 1, end: 0 },
    tint: [0xfb923c, 0xf97316, 0xfacc15, 0xef4444],
    blendMode: Phaser.BlendModes.ADD,
    frequency: front ? 280 : 70,
    advance: 4000
  });

  scene.add.particles(0, 0, TEXTURE_KEYS.ember, config(false)).setScrollFactor(0).setDepth(BACK_DEPTH);
  scene.add.particles(0, 0, TEXTURE_KEYS.ember, config(true)).setScrollFactor(0).setDepth(FRONT_DEPTH);

  const glow = scene.add
    .rectangle(0, 0, width, height, 0xf97316, 0.05)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(1);
  scene.tweens.add({ targets: glow, alpha: { from: 0.03, to: 0.09 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
}

/** A neon colour wash that hums and sometimes stutters, like signs on a bad circuit. */
function addNeonFlicker(scene: Phaser.Scene, width: number, height: number): void {
  const wash = scene.add
    .rectangle(0, 0, width, height, 0xec4899, 0.04)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(1);
  scene.tweens.add({ targets: wash, alpha: { from: 0.03, to: 0.07 }, duration: 1600, yoyo: true, repeat: -1 });

  const stutter = (): void => {
    wash.setFillStyle(Phaser.Math.RND.pick([0xec4899, 0x22d3ee, 0xa855f7]), 0.04);
    scene.tweens.chain({
      targets: wash,
      tweens: [
        { alpha: 0, duration: 40 },
        { alpha: 0.1, duration: 40 },
        { alpha: 0, duration: 60 },
        { alpha: 0.06, duration: 80 }
      ]
    });
    scene.time.delayedCall(Phaser.Math.Between(2500, 6000), stutter);
  };
  scene.time.delayedCall(2000, stutter);
}

/** Draws the small particle textures once per game. */
function ensureTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;

  if (!textures.exists(TEXTURE_KEYS.petal)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillEllipse(5, 3, 10, 6);
    g.fillStyle(0xf9a8d4, 1).fillEllipse(6, 3, 5, 3);
    g.generateTexture(TEXTURE_KEYS.petal, 10, 6);
    g.destroy();
  }

  if (!textures.exists(TEXTURE_KEYS.drop)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xbfdbfe, 1).fillRect(0, 0, 2, 18);
    g.generateTexture(TEXTURE_KEYS.drop, 2, 18);
    g.destroy();
  }

  if (!textures.exists(TEXTURE_KEYS.ember)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 0.35).fillCircle(4, 4, 4);
    g.fillStyle(0xffffff, 1).fillRect(3, 3, 2, 2);
    g.generateTexture(TEXTURE_KEYS.ember, 8, 8);
    g.destroy();
  }

  if (!textures.exists(TEXTURE_KEYS.mist)) {
    const canvas = textures.createCanvas(TEXTURE_KEYS.mist, 320, 96);
    const ctx = canvas?.getContext();
    if (canvas && ctx) {
      const gradient = ctx.createRadialGradient(160, 48, 4, 160, 48, 160);
      gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.scale(1, 0.3);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 320, 320);
      ctx.restore();
      canvas.refresh();
    }
  }
}
