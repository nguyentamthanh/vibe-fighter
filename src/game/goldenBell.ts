import * as Phaser from 'phaser';

import { playBellStrike } from './core/audio';
import type { Fighter } from './fighter';
import type { GameSettings } from './types';
import { spawnImpactFlash } from './vfx';

/** Fighters whose block raises the Golden Bell (Kim Chung Tráo) around them. */
export const GOLDEN_BELL_FIGHTERS = ['shaolin-monk'];

const IDLE_KEY = 'golden-bell-idle';
const HIT_KEY = 'golden-bell-hit';
/** The effect sheets (built by effect.py) put the bell's bottom rim 6px above the bottom of each 384px-tall frame. */
const ORIGIN_Y = 378 / 384;
/** Height of the bell body in the sheets, and the fighters' standing height in sprite pixels. */
const BELL_CORE_HEIGHT = 372;
const FIGHTER_HEIGHT = 196;
/** The bell stands this many times taller than the fighter it protects. */
const BELL_TO_FIGHTER_HEIGHT = 1.4;
/** Bell scale per unit of the fighter's display scale. */
const SIZE_FACTOR = (FIGHTER_HEIGHT * BELL_TO_FIGHTER_HEIGHT) / BELL_CORE_HEIGHT;
/**
 * The bell is drawn twice so the fighter stands INSIDE it: a bold copy behind him (the back wall of the bell)
 * and a faint copy in front (the glossy near wall), which keeps the fighter readable.
 */
const BACK_ALPHA = 0.95;
const FRONT_ALPHA = 0.3;
const BACK_TINT = 0x7a5a32;
/** Drops the rim slightly below the feet so the bell looks planted on the floor. */
const RIM_OFFSET_Y = 8;

interface BellLayer {
  idle: Phaser.GameObjects.Sprite;
  hit: Phaser.GameObjects.Sprite | null;
  alpha: number;
  /** Depth relative to the fighter sprite. */
  depthOffset: number;
}

/**
 * The Shaolin Monk's guard effect: a tall bronze-gold temple bell around him that rises while
 * he blocks and rings — shockwave frames, a wobble, a gold flash and a "dong" — when an
 * attack is blocked.
 */
export class GoldenBellShield {
  private readonly layers: BellLayer[];

  private shown = false;

  private striking = false;

  private tweens: Phaser.Tweens.Tween[] = [];

  /**
   * @param scene - The match scene.
   * @param fighter - The fighter the bell protects.
   * @param getSettings - Reads the current audio settings (for the bell sound).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fighter: Fighter,
    private readonly getSettings: () => GameSettings
  ) {
    this.layers = [
      this.createLayer(BACK_ALPHA, -0.5),
      this.createLayer(FRONT_ALPHA, 1)
    ];
  }

  private createLayer(alpha: number, depthOffset: number): BellLayer {
    const { scene, fighter } = this;
    const idle = scene.add
      .sprite(fighter.x, fighter.groundLine, IDLE_KEY, 0)
      .setOrigin(0.5, ORIGIN_Y)
      .setAlpha(0)
      .setVisible(false);

    if (scene.anims.exists(IDLE_KEY)) {
      idle.play(IDLE_KEY);
    }

    const hit = scene.textures.exists(HIT_KEY)
      ? scene.add.sprite(fighter.x, fighter.groundLine, HIT_KEY, 0).setOrigin(0.5, ORIGIN_Y).setVisible(false)
      : null;

    if (depthOffset < 0) {
      // The back wall is darker bronze, so the fighter in front of it stands out.
      idle.setTint(BACK_TINT);
      hit?.setTint(BACK_TINT);
    }

    return { idle, hit, alpha, depthOffset };
  }

  private get scale(): number {
    return this.fighter.displayScale * SIZE_FACTOR;
  }

  /** Follows the fighter and raises / lowers the bell with his block. Call once per frame. */
  update(): void {
    const x = this.fighter.x;
    const y = this.fighter.groundLine + RIM_OFFSET_Y;
    const depth = this.fighter.spriteDepth;

    this.layers.forEach((layer) => {
      const at = depth + layer.depthOffset;
      layer.idle.setPosition(x, y).setDepth(at);
      layer.hit?.setPosition(x, y).setDepth(at);
    });

    const guarding = this.fighter.isGuarding;

    if (guarding && !this.shown) {
      this.show();
    } else if (!guarding && this.shown && !this.striking) {
      this.lower();
    }
  }

  /**
   * Rings the bell for a blocked attack.
   * @param contactX - World x of the impact (for the flash).
   * @param contactY - World y of the impact.
   * @param attackerX - The attacker's x, so the shockwave starts on the side that was hit.
   */
  strike(contactX: number, contactY: number, attackerX: number): void {
    if (!this.shown) {
      this.show();
    }

    const scale = this.scale;
    this.striking = true;
    const canPlayHit = this.scene.anims.exists(HIT_KEY);

    this.layers.forEach((layer, index) => {
      const sprites = [layer.idle, layer.hit].filter((s): s is Phaser.GameObjects.Sprite => s !== null);
      this.tweens.push(
        this.scene.tweens.add({
          targets: sprites,
          scaleX: { from: scale * 1.1, to: scale },
          scaleY: { from: scale * 0.94, to: scale },
          duration: 360,
          ease: 'Elastic.Out'
        })
      );

      if (canPlayHit && layer.hit) {
        // The hit sheet is drawn struck from the right; mirror it for attacks from the left.
        layer.hit.setFlipX(attackerX < this.fighter.x).setAlpha(layer.alpha).setVisible(true);
        layer.idle.setVisible(false);
        layer.hit.play({ key: HIT_KEY, repeat: 0 });

        if (index === 0) {
          layer.hit.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.endStrike());
        }
      }
    });

    if (!canPlayHit) {
      this.scene.time.delayedCall(260, () => this.endStrike());
    }

    spawnImpactFlash(this.scene, contactX, contactY, 'gold', 62);
    playBellStrike(this.getSettings());
  }

  /** Hides the bell immediately (round reset). */
  hide(): void {
    this.stopTweens();
    this.shown = false;
    this.striking = false;
    this.layers.forEach((layer) => {
      layer.idle.setVisible(false).setAlpha(0);
      layer.hit?.setVisible(false);
    });
  }

  destroy(): void {
    this.stopTweens();
    this.layers.forEach((layer) => {
      layer.idle.destroy();
      layer.hit?.destroy();
    });
  }

  private stopTweens(): void {
    this.tweens.forEach((tween) => tween.stop());
    this.tweens = [];
  }

  private show(): void {
    const scale = this.scale;
    this.shown = true;
    this.stopTweens();

    this.layers.forEach((layer) => {
      layer.idle.setVisible(!this.striking).setScale(scale * 0.82);
      this.tweens.push(
        this.scene.tweens.add({ targets: layer.idle, alpha: layer.alpha, scale, duration: 140, ease: 'Back.Out' })
      );
    });
  }

  private lower(): void {
    this.shown = false;
    this.stopTweens();

    this.layers.forEach((layer) => {
      this.tweens.push(
        this.scene.tweens.add({
          targets: layer.idle,
          alpha: 0,
          scale: this.scale * 1.06,
          duration: 160,
          ease: 'Sine.In',
          onComplete: () => layer.idle.setVisible(false)
        })
      );
    });
  }

  private endStrike(): void {
    this.striking = false;

    this.layers.forEach((layer) => {
      layer.hit?.setVisible(false);

      if (this.shown) {
        layer.idle.setVisible(true).setAlpha(layer.alpha).setScale(this.scale);
      }
    });
  }
}
