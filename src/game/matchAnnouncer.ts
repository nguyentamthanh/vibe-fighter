import * as Phaser from 'phaser';

import { playArcadeSting, type ArcadeSting } from './core/audio';
import { DISPLAY_FONT } from './menuBackdrop';
import type { GameSettings } from './types';
import { fitTextToBox } from './ui';

/** Top → bottom fill colours of an announcer word. */
type Gradient = [string, string, string];

const GOLD: Gradient = ['#fff7c2', '#facc15', '#d97706'];
const FIRE: Gradient = ['#fff1a8', '#fb923c', '#dc2626'];
const BLOOD: Gradient = ['#fecaca', '#ef4444', '#7f1d1d'];
const STEEL: Gradient = ['#ffffff', '#cbd5e1', '#64748b'];

const STRIPE_HEIGHT = 150;
const STRIPE_SKEW = 40;

/**
 * The arcade announcer for a match: ROUND n / FINAL ROUND, FIGHT!, K.O.,
 * PERFECT, TIME UP and DRAW calls. Each call slides a slanted dark stripe
 * across the screen and slams a gradient word onto it in the display font,
 * with a synthesized sting; a K.O. adds a white flash and a camera shake.
 * Everything is screen-space and sits above the HUD.
 */
export class MatchAnnouncer {
  private readonly scene: Phaser.Scene;
  private readonly settings: () => GameSettings;
  private readonly stripe: Phaser.GameObjects.Graphics;
  private readonly word: Phaser.GameObjects.Text;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private stripeColor = 0xfacc15;

  /**
   * @param scene - The match scene.
   * @param depth - Render depth (above the HUD, below the results overlay).
   * @param settings - Reads the current audio settings.
   */
  constructor(scene: Phaser.Scene, depth: number, settings: () => GameSettings) {
    this.scene = scene;
    this.settings = settings;
    const { centerX, centerY, width, height } = scene.cameras.main;

    this.stripe = scene.add.graphics().setScrollFactor(0).setDepth(depth).setAlpha(0);
    this.stripe.setPosition(centerX, centerY - 30);

    this.word = scene.add
      .text(centerX, centerY - 38, '', {
        fontFamily: DISPLAY_FONT,
        fontSize: '72px',
        stroke: '#1c0a00',
        strokeThickness: 12,
        padding: { x: 12, y: 12 }
      })
      .setOrigin(0.5)
      .setShadow(0, 8, '#000000', 0, true, true)
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setAlpha(0);

    this.caption = scene.add
      .text(centerX, centerY + 28, '', {
        color: '#f8fafc',
        fontFamily: DISPLAY_FONT,
        fontSize: '18px',
        stroke: '#020617',
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setAlpha(0);

    this.flash = scene.add
      .rectangle(0, 0, width, height, 0xffffff, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth + 2);
  }

  /**
   * Calls the round: "ROUND n", or "FINAL ROUND" when the next win decides the match.
   * @param round - The round number.
   * @param final - Whether this is the deciding round.
   */
  showRound(round: number, final: boolean): void {
    this.call(final ? 'FINAL ROUND' : `ROUND ${round}`, final ? FIRE : STEEL, final ? 0xef4444 : 0x94a3b8, 'round');
  }

  /** Calls the start of the fight. */
  showFight(): void {
    this.call('FIGHT!', FIRE, 0xf97316, 'fight', 1.15);
    this.scene.cameras.main.shake(160, 0.004);
  }

  /**
   * Calls a knockout with a white flash and a heavy shake.
   * @param winnerName - Shown under the word ("<NAME> WINS").
   * @param perfect - The winner took no damage this round.
   */
  showKnockout(winnerName: string, perfect: boolean): void {
    this.flash.setAlpha(0.85);
    this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 380, ease: 'Quad.Out' });
    this.scene.cameras.main.shake(380, 0.012);
    this.call('K.O.', BLOOD, 0xdc2626, 'ko', 1.35);

    this.scene.time.delayedCall(650, () => {
      if (perfect) {
        this.call('PERFECT', GOLD, 0xfacc15, 'fight', 1.1);
      }
      this.showCaption(`${winnerName} WINS`);
    });
  }

  /**
   * Calls the end of a round on the clock.
   * @param winnerName - Shown under the word.
   */
  showTimeUp(winnerName: string): void {
    this.call('TIME UP', GOLD, 0xfacc15, 'round', 1.1);
    this.scene.time.delayedCall(450, () => this.showCaption(`${winnerName} WINS`));
  }

  /** Calls a drawn round (equal health when the clock ran out). */
  showDraw(): void {
    this.call('DRAW', STEEL, 0x94a3b8, 'round', 1.1);
    this.showCaption('NO WINNER - REPLAY THE ROUND');
  }

  /** Slides everything out. */
  hide(): void {
    this.scene.tweens.add({ targets: [this.word, this.caption], alpha: 0, duration: 220 });
    this.scene.tweens.add({ targets: this.stripe, alpha: 0, scaleY: 0.2, duration: 260, ease: 'Quad.In' });
  }

  /** Removes the announcer's objects. */
  destroy(): void {
    [this.stripe, this.word, this.caption, this.flash].forEach((object) => object.destroy());
  }

  /**
   * Shows one announcer word: the stripe slides in from the left, the word
   * slams down from big to its resting scale.
   */
  private call(text: string, gradient: Gradient, stripeColor: number, sting: ArcadeSting, peak = 1): void {
    const { width } = this.scene.cameras.main;
    this.scene.tweens.killTweensOf([this.word, this.stripe, this.caption]);

    this.stripeColor = stripeColor;
    this.drawStripe(width);
    this.stripe.setAlpha(1).setScale(1, 1).setX(-width);
    this.scene.tweens.add({ targets: this.stripe, x: width / 2, duration: 220, ease: 'Cubic.Out' });

    this.word.setText(text).setFontSize(72).setScale(1);
    fitTextToBox(this.word, width - 80, STRIPE_HEIGHT, 28);
    this.applyGradient(gradient);
    this.word.setAlpha(0).setScale(peak * 2.4);
    this.scene.tweens.add({ targets: this.word, alpha: 1, scale: peak, duration: 240, ease: 'Back.Out' });
    this.caption.setAlpha(0);

    playArcadeSting(this.settings(), sting);
  }

  private showCaption(text: string): void {
    const { width } = this.scene.cameras.main;
    this.caption.setText(text).setFontSize(18);
    fitTextToBox(this.caption, width - 80, 40, 10);
    this.caption.setAlpha(0).setY(this.word.y + 74);
    this.scene.tweens.add({ targets: this.caption, alpha: 1, y: this.word.y + 64, duration: 260, ease: 'Quad.Out' });
  }

  /** A slanted dark band with bright rims, drawn around (0, 0). */
  private drawStripe(width: number): void {
    const half = STRIPE_HEIGHT / 2;
    const left = -width / 2 - STRIPE_SKEW;
    const right = width / 2 + STRIPE_SKEW;
    const band = [
      new Phaser.Math.Vector2(left + STRIPE_SKEW, -half),
      new Phaser.Math.Vector2(right, -half),
      new Phaser.Math.Vector2(right - STRIPE_SKEW, half),
      new Phaser.Math.Vector2(left, half)
    ];

    this.stripe.clear();
    this.stripe.fillGradientStyle(0x020617, 0x020617, 0x0f172a, 0x0f172a, 0.92, 0.92, 0.82, 0.82);
    this.stripe.fillPoints(band, true);
    this.stripe.fillStyle(this.stripeColor, 1);
    this.stripe.fillRect(left, -half - 2, right - left, 5);
    this.stripe.fillRect(left, half - 3, right - left, 5);
    this.stripe.fillStyle(this.stripeColor, 0.35);
    this.stripe.fillRect(left, -half + 8, right - left, 2);
    this.stripe.fillRect(left, half - 10, right - left, 2);
  }

  /** Fills the word with a vertical gradient (canvas text supports gradient fills). */
  private applyGradient([top, middle, bottom]: Gradient): void {
    const gradient = this.word.context.createLinearGradient(0, 0, 0, this.word.height);
    gradient.addColorStop(0.2, top);
    gradient.addColorStop(0.55, middle);
    gradient.addColorStop(0.85, bottom);
    this.word.setFill(gradient);
  }
}
