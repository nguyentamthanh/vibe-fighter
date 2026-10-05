import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { GAME_TAGLINE } from '../game/constants';
import { getCharacterAnimationByAction, type CharacterDefinition } from '../game/hero';
import { createMenuBackdrop, DISPLAY_FONT, ensureGlowTexture } from '../game/menuBackdrop';
import { SELECTABLE_ROSTER } from '../game/roster';
import { STAGE_DEFINITIONS } from '../game/stageConfig';
import { createBannerButton, type TextButton } from '../game/ui';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

interface MenuOption {
  label: string;
  action: () => void;
}

/** Where one showcase fighter stands: side -1 = left (faces right), 1 = right (faces left). */
interface LineupSlot {
  x: number;
  scale: number;
  side: -1 | 1;
  back: boolean;
}

interface ShowcaseFighter {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  slot: LineupSlot;
}

interface TitleLayout {
  logoY: number;
  logoScale: number;
  ribbonY: number;
  menuY: number;
  menuGap: number;
  groundY: number;
  slots: LineupSlot[];
}

const LINEUP_SIZE = 4;
const LINEUP_INTERVAL_MS = 5600;
const SLIDE_DISTANCE = 280;
const BACK_ROW_TINT = 0x7c86a8;

/**
 * Title screen: the rooftop stage drifting behind a glowing VIBE FIGHTER logo,
 * a rotating line-up of fighters standing on both sides (cycling through the
 * whole roster), a stats ribbon, and slanted arcade menu buttons.
 */
export class MainMenuScene extends BaseScene {
  private selectedIndex = 0;

  private buttons: TextButton[] = [];

  private options: MenuOption[] = [];

  private lineup: ShowcaseFighter[] = [];

  private lineupOffset = 0;

  private transitioning = false;

  private layout!: TitleLayout;

  constructor() {
    super(SCENE_KEYS.MainMenu);
  }

  create(): void {
    this.buttons = [];
    this.selectedIndex = 0;
    this.options = [];
    this.lineup = [];
    this.lineupOffset = 0;
    this.transitioning = false;
    this.layout = this.computeLayout();

    this.markActiveScene(SCENE_KEYS.MainMenu);
    this.cameras.main.setBackgroundColor(0x020617);
    this.cameras.main.fadeIn(450, 2, 6, 23);

    createMenuBackdrop(this, { dim: 0.42 });
    this.showLineup(true);
    this.buildLogo();
    this.buildRibbon();
    this.renderMenu();

    this.time.addEvent({
      delay: LINEUP_INTERVAL_MS,
      loop: true,
      callback: () => {
        this.lineupOffset = (this.lineupOffset + LINEUP_SIZE) % Math.max(SELECTABLE_ROSTER.length, 1);
        this.showLineup(false);
      }
    });

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-UP', () => this.moveSelection(-1));
    keyboard?.on('keydown-W', () => this.moveSelection(-1));
    keyboard?.on('keydown-DOWN', () => this.moveSelection(1));
    keyboard?.on('keydown-S', () => this.moveSelection(1));
    keyboard?.on('keydown-ENTER', () => this.confirmOption(this.options[this.selectedIndex]));
    keyboard?.on('keydown-SPACE', () => this.confirmOption(this.options[this.selectedIndex]));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearButtons();
      this.lineup = [];
      this.selectedIndex = 0;
      this.options = [];
    });

    this.createFooterHint('Arrow keys / WASD to navigate • Enter / Space to confirm');
  }

  private computeLayout(): TitleLayout {
    const { width, height } = this.cameras.main;

    if (height > width) {
      // Portrait (mobile): logo and menu on top, the line-up along the bottom.
      return {
        logoY: 230,
        logoScale: 0.86,
        ribbonY: 380,
        menuY: 540,
        menuGap: 86,
        groundY: height - 96,
        slots: [
          { x: width * 0.08, scale: 1.05, side: -1, back: true },
          { x: width * 0.92, scale: 1.05, side: 1, back: true },
          { x: width * 0.3, scale: 1.35, side: -1, back: false },
          { x: width * 0.7, scale: 1.35, side: 1, back: false }
        ]
      };
    }

    return {
      logoY: 128,
      logoScale: 1,
      ribbonY: 268,
      menuY: 372,
      menuGap: 80,
      groundY: height - 92,
      slots: [
        { x: width * 0.07, scale: 1.15, side: -1, back: true },
        { x: width * 0.93, scale: 1.15, side: 1, back: true },
        { x: width * 0.18, scale: 1.5, side: -1, back: false },
        { x: width * 0.82, scale: 1.5, side: 1, back: false }
      ]
    };
  }

  /** Logo with a gradient fill, a pulsing light behind it, a slam-in intro and a gentle float. */
  private buildLogo(): void {
    const { centerX } = this.cameras.main;
    const { logoY, logoScale } = this.layout;

    const glow = this.add
      .image(centerX, logoY, ensureGlowTexture(this))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(4.2 * logoScale, 1.7 * logoScale)
      .setAlpha(0)
      .setDepth(8);

    const vibe = this.createLogoText('VIBE', 54, -46, ['#a5f3fc', '#38bdf8', '#2563eb']);
    const fighter = this.createLogoText('FIGHTER', 80, 32, ['#fef08a', '#fb923c', '#dc2626']);
    const tagline = this.add
      .text(0, 96, GAME_TAGLINE.toUpperCase(), {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '15px',
        stroke: '#020617',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    const logo = this.add.container(centerX, logoY, [vibe, fighter, tagline]).setDepth(10);
    logo.setScale(2.4 * logoScale).setAlpha(0);

    this.tweens.add({
      targets: logo,
      scale: logoScale,
      alpha: 1,
      duration: 520,
      delay: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.cameras.main.shake(180, 0.006);
        this.flashScreen(0.35);
        this.tweens.add({ targets: logo, y: logoY - 6, duration: 2200, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
      }
    });

    this.tweens.add({
      targets: glow,
      alpha: { from: 0.35, to: 0.7 },
      duration: 1600,
      delay: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }

  private createLogoText(text: string, size: number, y: number, colors: string[]): Phaser.GameObjects.Text {
    const label = this.add
      .text(0, y, text, {
        fontFamily: DISPLAY_FONT,
        fontSize: `${size}px`,
        color: colors[0],
        stroke: '#1e1b4b',
        strokeThickness: Math.round(size / 6),
        padding: { x: 8, y: 8 }
      })
      .setOrigin(0.5)
      .setShadow(0, Math.round(size / 9), '#000000', 0, true, true);

    const gradient = label.context.createLinearGradient(0, 0, 0, label.height);
    colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
    label.setFill(gradient);

    return label;
  }

  /** Red ribbon under the logo with the roster and stage counts; slides in after the logo. */
  private buildRibbon(): void {
    const { centerX } = this.cameras.main;
    const text = `${SELECTABLE_ROSTER.length} FIGHTERS  •  ${STAGE_DEFINITIONS.length} STAGES  •  1P / 2P`;
    const label = this.add
      .text(0, 1, text, {
        color: '#fff7ed',
        fontFamily: DISPLAY_FONT,
        fontSize: '13px',
        stroke: '#450a0a',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    const halfWidth = label.width / 2 + 44;
    const halfHeight = 20;
    const notch = 14;
    const band = this.add.graphics();
    // Darker notched tails behind the band ends (mirrored per side), then the band with a light top edge.
    band.fillStyle(0x7f1d1d, 1);
    [-1, 1].forEach((side) => {
      const outer = side * (halfWidth + 26);
      const inner = side * (halfWidth - 10);
      band.fillPoints(
        [
          new Phaser.Math.Vector2(outer, -halfHeight + 8),
          new Phaser.Math.Vector2(inner, -halfHeight + 8),
          new Phaser.Math.Vector2(inner, halfHeight + 8),
          new Phaser.Math.Vector2(outer, halfHeight + 8),
          new Phaser.Math.Vector2(outer - side * notch, 8)
        ],
        true
      );
    });
    band.fillGradientStyle(0xef4444, 0xdc2626, 0xb91c1c, 0x991b1b, 1, 1, 1, 1);
    band.fillRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
    band.fillStyle(0xffffff, 0.2);
    band.fillRect(-halfWidth, -halfHeight, halfWidth * 2, 4);
    band.lineStyle(2, 0xfca5a5, 0.8);
    band.strokeRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);

    const ribbon = this.add.container(centerX - 120, this.layout.ribbonY, [band, label]).setDepth(9).setAlpha(0);
    this.tweens.add({ targets: ribbon, x: centerX, alpha: 1, duration: 420, delay: 700, ease: 'Cubic.easeOut' });
  }

  /**
   * Shows the next group of fighters: the current ones slide out to their side
   * while the new ones slide in, and the front row powers up once on arrival.
   * @param first - True on scene start (no exit, staggered entrance after the logo).
   */
  private showLineup(first: boolean): void {
    const roster = SELECTABLE_ROSTER;
    if (roster.length === 0) {
      return;
    }

    this.lineup.forEach(({ sprite, shadow, slot }) => {
      this.tweens.add({
        targets: [sprite, shadow],
        x: slot.x + slot.side * SLIDE_DISTANCE,
        alpha: 0,
        duration: 320,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          sprite.destroy();
          shadow.destroy();
        }
      });
    });

    if (!first) {
      this.flashScreen(0.12);
    }

    const count = Math.min(LINEUP_SIZE, roster.length);
    this.lineup = this.layout.slots.slice(0, count).map((slot, index) => {
      const character = roster[(this.lineupOffset + index) % roster.length];
      const delay = (first ? 450 : 260) + index * 90;
      return this.spawnFighter(character, slot, delay);
    });
  }

  private spawnFighter(character: CharacterDefinition, slot: LineupSlot, delay: number): ShowcaseFighter {
    const { groundY } = this.layout;
    const idleKey = getCharacterAnimationByAction(character.id, 'idle').key;
    const startX = slot.x + slot.side * SLIDE_DISTANCE;

    const shadow = this.add
      .ellipse(startX, groundY - 4 * slot.scale, 107 * slot.scale, 24 * slot.scale, 0x000000, 0.4)
      .setAlpha(0)
      .setDepth(slot.back ? 1 : 3);

    const sprite = this.add
      .sprite(startX, groundY, idleKey, 0)
      .setOrigin(0.5, character.anchor.y)
      .setScale(slot.scale)
      // Sprites are drawn facing left: the left side flips to face the centre.
      .setFlipX(slot.side === -1)
      .setAlpha(0)
      .setDepth(slot.back ? 2 : 4);
    sprite.play({ key: idleKey, repeat: -1 });

    if (slot.back) {
      sprite.setTint(BACK_ROW_TINT);
    }

    this.tweens.add({
      targets: [sprite, shadow],
      x: slot.x,
      alpha: 1,
      duration: 460,
      delay,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!slot.back) {
          this.powerUp(sprite, character, idleKey);
        }
      }
    });

    return { sprite, shadow, slot };
  }

  /** Plays the fighter's special-charge once, then returns to idle. */
  private powerUp(sprite: Phaser.GameObjects.Sprite, character: CharacterDefinition, idleKey: string): void {
    const charge = character.animations.find((animation) => animation.action === 'special-charge');
    if (!charge || !sprite.active) {
      return;
    }

    sprite.play({ key: charge.key, repeat: 0 });
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (sprite.active) {
        sprite.play({ key: idleKey, repeat: -1 });
      }
    });
  }

  private flashScreen(alpha: number): void {
    const { width, height } = this.cameras.main;
    const flash = this.add.rectangle(0, 0, width, height, 0xfff7ed, alpha).setOrigin(0).setDepth(50);
    this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
  }

  private moveSelection(direction: number): void {
    const next = Phaser.Math.Wrap(this.selectedIndex + direction, 0, this.buttons.length);
    this.setSelection(next);
  }

  private setSelection(index: number): void {
    this.selectedIndex = index;
    this.buttons.forEach((button, buttonIndex) => {
      button.setSelected(buttonIndex === index);
    });
  }

  private renderMenu(): void {
    this.clearButtons();

    const playOption: MenuOption = { label: 'Play', action: () => this.scene.start(SCENE_KEYS.ModeSelect) };
    const settingsOption: MenuOption = { label: 'Settings', action: () => this.scene.start(SCENE_KEYS.Settings) };
    this.options = [playOption, settingsOption];

    const { centerX } = this.cameras.main;
    const { menuY, menuGap } = this.layout;

    this.options.forEach((option, optionIndex) => {
      const button = createBannerButton(this, {
        x: centerX,
        y: menuY + optionIndex * menuGap,
        width: 380,
        height: 60,
        label: option.label,
        fontFamily: DISPLAY_FONT,
        onClick: () => this.confirmOption(option),
        onHover: () => this.setSelection(optionIndex)
      });
      button.group.setDepth(10).setAlpha(0);
      this.tweens.add({ targets: button.group, alpha: 1, duration: 300, delay: 900 + optionIndex * 120 });

      this.buttons.push(button);
    });

    this.setSelection(0);
  }

  private clearButtons(): void {
    this.buttons.forEach((button) => {
      button.destroy();
    });
    this.buttons = [];
  }

  private confirmOption(option?: MenuOption): void {
    if (!option || this.transitioning) {
      return;
    }

    this.transitioning = true;
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
    this.flashScreen(0.25);
    this.cameras.main.fadeOut(220, 2, 6, 23);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => option.action());
  }
}
