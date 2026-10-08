import * as Phaser from 'phaser';

import { playArcadeSting } from './core/audio';
import { getCharacterDefinition } from './hero';
import { getFighterLore } from './lore';
import { DISPLAY_FONT } from './menuBackdrop';
import type { GameSettings, MatchMode } from './types';
import { createBannerButton, fitTextToBox, type TextButton } from './ui';

/** How a round ended. */
export type RoundOutcome = 'ko' | 'perfect' | 'time' | 'draw';

/** One finished round: who took it (0 = nobody) and how. */
export interface RoundRecord {
  winner: 0 | 1 | 2;
  outcome: RoundOutcome;
}

export interface MatchResultsOptions {
  mode: MatchMode;
  p1CharacterId: string;
  p2CharacterId: string;
  p1Wins: number;
  p2Wins: number;
  roundsToWin: number;
  winner: 1 | 2;
  rounds: RoundRecord[];
  depth: number;
  settings: () => GameSettings;
  onRematch(): void;
  onMenu(): void;
}

const P1_COLOR = 0x38bdf8;
const P2_COLOR = 0xf43f5e;
const WIN_GOLD = 0xfacc15;
const OUTCOME_LABEL: Record<RoundOutcome, string> = { ko: 'K.O.', perfect: 'PERFECT', time: 'TIME', draw: 'DRAW' };
// Keys pressed while the panel is still flying in are ignored, so mashing at the K.O. doesn't skip it.
const INPUT_DELAY_MS = 900;

/**
 * The end-of-match results screen: a VICTORY / DEFEAT (or PLAYER n WINS) title,
 * both fighters' portrait cards (the winner framed in gold with a WINNER
 * ribbon, the loser dimmed), the round score, a chip per round (K.O., PERFECT,
 * TIME, DRAW), the winner's victory quote, and Rematch / Main Menu banner
 * buttons driven by arrows + Enter or the mouse. Lays itself out from the
 * camera size, so it works in landscape and portrait.
 */
export class MatchResults {
  private readonly scene: Phaser.Scene;
  private readonly options: MatchResultsOptions;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private buttons: TextButton[] = [];
  private actions: Array<() => void> = [];
  private selected = 0;
  private acceptingInput = false;
  private readonly keyHandlers: Array<[string, () => void]> = [];

  constructor(scene: Phaser.Scene, options: MatchResultsOptions) {
    this.scene = scene;
    this.options = options;
    this.build();
    playArcadeSting(options.settings(), 'victory');
    scene.time.delayedCall(INPUT_DELAY_MS, () => {
      this.acceptingInput = true;
    });
  }

  /** Removes every object and key handler of the screen. */
  destroy(): void {
    const keyboard = this.scene.input.keyboard;
    this.keyHandlers.forEach(([event, handler]) => keyboard?.off(event, handler));
    this.keyHandlers.length = 0;
    this.buttons.forEach((button) => button.destroy());
    this.buttons = [];
    this.objects.forEach((object) => object.destroy());
    this.objects.length = 0;
  }

  private build(): void {
    const { width, height, centerX } = this.scene.cameras.main;
    const { depth } = this.options;
    const portraitLayout = height > width;

    const dim = this.track(
      this.scene.add.rectangle(0, 0, width, height, 0x020617, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(depth)
    );
    this.scene.tweens.add({ targets: dim, fillAlpha: 0.8, duration: 300 });

    const titleY = Math.round(height * (portraitLayout ? 0.1 : 0.11));
    this.buildTitle(centerX, titleY, width);

    const cardWidth = Math.round(Math.min(280, (width - 80 - (portraitLayout ? 150 : 220)) / 2));
    const cardHeight = Math.round(cardWidth * 1.3);
    const cardsY = Math.round(height * (portraitLayout ? 0.4 : 0.44));
    const cardOffset = cardWidth / 2 + (portraitLayout ? 75 : 110);
    this.buildCard(1, centerX - cardOffset, cardsY, cardWidth, cardHeight);
    this.buildCard(2, centerX + cardOffset, cardsY, cardWidth, cardHeight);
    this.buildScore(centerX, cardsY);

    const chipsY = cardsY + cardHeight / 2 + 34;
    this.buildRoundChips(centerX, chipsY);
    this.buildQuote(centerX, chipsY + 48, Math.min(width - 100, 820));
    // Landscape pins the buttons to the bottom; portrait keeps them under the quote instead of far below it.
    this.buildButtons(centerX, portraitLayout ? chipsY + 190 : height - 64);
  }

  /** VICTORY / DEFEAT against the CPU, PLAYER n WINS in versus, on a slanted gold band. */
  private buildTitle(x: number, y: number, width: number): void {
    const { mode, winner, depth } = this.options;
    const playerLost = mode === '1vcpu' && winner === 2;
    const text = mode === '1vcpu' ? (playerLost ? 'DEFEAT' : 'VICTORY!') : `PLAYER ${winner} WINS`;
    const bandColor = playerLost ? 0x7f1d1d : 0x92400e;

    const band = this.track(this.scene.add.graphics().setScrollFactor(0).setDepth(depth + 1));
    const half = 46;
    band.fillStyle(bandColor, 0.85);
    band.fillPoints(
      [
        new Phaser.Math.Vector2(-width / 2 + 60, -half),
        new Phaser.Math.Vector2(width / 2 + 20, -half),
        new Phaser.Math.Vector2(width / 2 - 20, half),
        new Phaser.Math.Vector2(-width / 2 - 60, half)
      ],
      true
    );
    band.fillStyle(playerLost ? 0xef4444 : WIN_GOLD, 1);
    band.fillRect(-width / 2 - 60, -half - 3, width + 120, 4);
    band.fillRect(-width / 2 - 60, half - 1, width + 120, 4);
    band.setPosition(x - width, y);
    this.scene.tweens.add({ targets: band, x, duration: 320, ease: 'Cubic.Out' });

    const title = this.track(
      this.scene.add
        .text(x, y, text, {
          fontFamily: DISPLAY_FONT,
          fontSize: '52px',
          stroke: '#1c0a00',
          strokeThickness: 10,
          padding: { x: 10, y: 10 }
        })
        .setOrigin(0.5)
        .setShadow(0, 6, '#000000', 0, true, true)
        .setScrollFactor(0)
        .setDepth(depth + 2)
    );
    fitTextToBox(title, width - 100, 90, 24);
    const gradient = title.context.createLinearGradient(0, 0, 0, title.height);
    const stops = playerLost ? ['#fecaca', '#ef4444', '#7f1d1d'] : ['#fff7c2', '#facc15', '#d97706'];
    stops.forEach((color, index) => gradient.addColorStop(0.2 + index * 0.32, color));
    title.setFill(gradient);
    title.setScale(2.2).setAlpha(0);
    this.scene.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 360, delay: 120, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: title, y: y - 4, duration: 900, delay: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** One fighter's card: portrait, side tag, name plate, round-win pips; the winner gets a gold frame and ribbon. */
  private buildCard(side: 1 | 2, x: number, y: number, cardWidth: number, cardHeight: number): void {
    const { mode, winner, depth, roundsToWin } = this.options;
    const characterId = side === 1 ? this.options.p1CharacterId : this.options.p2CharacterId;
    const character = getCharacterDefinition(characterId);
    const lore = getFighterLore(characterId);
    const won = side === winner;
    const sideColor = side === 1 ? P1_COLOR : P2_COLOR;
    const wins = side === 1 ? this.options.p1Wins : this.options.p2Wins;
    const parts: Phaser.GameObjects.GameObject[] = [];

    const frame = this.scene.add
      .rectangle(0, 0, cardWidth, cardHeight, 0x0f172a, 0.95)
      .setStrokeStyle(won ? 5 : 3, won ? WIN_GOLD : 0x475569, 1);
    parts.push(frame);
    if (won) {
      const glow = this.scene.add.rectangle(0, 0, cardWidth + 18, cardHeight + 18, WIN_GOLD, 0.18);
      parts.unshift(glow);
      this.scene.tweens.add({ targets: glow, alpha: { from: 0.1, to: 0.32 }, duration: 700, yoyo: true, repeat: -1 });
    }

    const imageSize = cardWidth - 20;
    const imageY = -cardHeight / 2 + 10 + imageSize / 2;
    if (this.scene.textures.exists(character.portrait.key)) {
      const portrait = this.scene.add.image(0, imageY, character.portrait.key);
      const source = Math.max(portrait.width, portrait.height) || imageSize;
      // Portraits face left; flip P1's so both look toward the centre.
      portrait.setScale(imageSize / source).setFlipX(side === 1);
      if (!won) {
        portrait.setTint(0x64748b);
      }
      parts.push(portrait);
    }

    const tag = this.scene.add
      .text(-cardWidth / 2 + 8, -cardHeight / 2 + 8, side === 1 ? 'P1' : mode === '1vcpu' ? 'CPU' : 'P2', {
        color: '#020617',
        backgroundColor: colorToCss(sideColor),
        fontFamily: DISPLAY_FONT,
        fontSize: '12px',
        padding: { x: 6, y: 4 }
      })
      .setOrigin(0, 0);
    parts.push(tag);

    const plateTop = imageY + imageSize / 2 + 8;
    const name = this.scene.add
      .text(0, plateTop + 4, character.label.toUpperCase(), {
        color: won ? '#fde68a' : '#cbd5e1',
        fontFamily: DISPLAY_FONT,
        fontSize: '16px',
        stroke: '#020617',
        strokeThickness: 4
      })
      .setOrigin(0.5, 0);
    fitTextToBox(name, cardWidth - 16, 24, 8);
    parts.push(name);

    if (lore) {
      const subtitle = this.scene.add
        .text(0, plateTop + 30, lore.name, { color: '#94a3b8', fontFamily: 'monospace', fontSize: '13px' })
        .setOrigin(0.5, 0);
      fitTextToBox(subtitle, cardWidth - 16, 18, 9);
      parts.push(subtitle);
    }

    const pipY = cardHeight / 2 - 16;
    for (let i = 0; i < roundsToWin; i++) {
      const pipX = (i - (roundsToWin - 1) / 2) * 26;
      parts.push(
        this.scene.add
          .circle(pipX, pipY, 8, i < wins ? WIN_GOLD : 0x1e293b, 1)
          .setStrokeStyle(2, i < wins ? 0xfff7c2 : 0x475569, 1)
      );
    }

    if (won) {
      const ribbon = this.scene.add
        .text(0, -cardHeight / 2 - 4, 'WINNER', {
          color: '#1c0a00',
          backgroundColor: '#facc15',
          fontFamily: DISPLAY_FONT,
          fontSize: '14px',
          padding: { x: 14, y: 6 }
        })
        .setOrigin(0.5)
        .setAngle(side === 1 ? -4 : 4);
      parts.push(ribbon);
    }

    const card = this.track(this.scene.add.container(x, y, parts).setScrollFactor(0).setDepth(depth + 2));
    const fromX = side === 1 ? -cardWidth : this.scene.cameras.main.width + cardWidth;
    card.setX(fromX);
    this.scene.tweens.add({ targets: card, x, duration: 480, delay: 200, ease: 'Back.Out' });
    if (won) {
      this.scene.tweens.add({ targets: card, scale: 1.04, duration: 260, delay: 700, yoyo: true, ease: 'Quad.Out' });
    }
  }

  /** The big "2 - 1" between the cards; the winner's number in gold. */
  private buildScore(x: number, y: number): void {
    const { p1Wins, p2Wins, winner, depth } = this.options;
    const style = (color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
      color,
      fontFamily: DISPLAY_FONT,
      fontSize: '44px',
      stroke: '#020617',
      strokeThickness: 8
    });
    const label = this.track(
      this.scene.add
        .text(x, y - 56, 'ROUNDS', { color: '#94a3b8', fontFamily: DISPLAY_FONT, fontSize: '12px' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(depth + 2)
    );
    const left = this.track(
      this.scene.add.text(x - 42, y, String(p1Wins), style(winner === 1 ? '#facc15' : '#64748b')).setOrigin(0.5)
    );
    const dash = this.track(this.scene.add.text(x, y, '-', style('#e2e8f0')).setOrigin(0.5));
    const right = this.track(
      this.scene.add.text(x + 42, y, String(p2Wins), style(winner === 2 ? '#facc15' : '#64748b')).setOrigin(0.5)
    );

    [left, dash, right].forEach((text, index) => {
      text.setScrollFactor(0).setDepth(depth + 2).setScale(0);
      this.scene.tweens.add({ targets: text, scale: 1, duration: 260, delay: 650 + index * 90, ease: 'Back.Out' });
    });
    label.setAlpha(0);
    this.scene.tweens.add({ targets: label, alpha: 1, duration: 300, delay: 650 });
  }

  /** A coloured chip per round: R1 K.O., R2 PERFECT, ... in the round winner's colour. */
  private buildRoundChips(x: number, y: number): void {
    const { rounds, depth } = this.options;
    const chips = rounds.map((round, index) => {
      const color = round.winner === 1 ? P1_COLOR : round.winner === 2 ? P2_COLOR : 0x64748b;
      const chip = this.scene.add
        .text(0, y, `R${index + 1}  ${OUTCOME_LABEL[round.outcome]}`, {
          color: '#020617',
          backgroundColor: colorToCss(color),
          fontFamily: DISPLAY_FONT,
          fontSize: '11px',
          padding: { x: 8, y: 6 }
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(depth + 2);
      if (round.outcome === 'perfect') {
        chip.setBackgroundColor('#facc15');
      }
      return this.track(chip);
    });

    const gap = 10;
    const total = chips.reduce((sum, chip) => sum + chip.width, 0) + gap * Math.max(0, chips.length - 1);
    let cursor = x - total / 2;
    chips.forEach((chip, index) => {
      chip.setX(cursor + chip.width / 2).setAlpha(0);
      cursor += chip.width + gap;
      this.scene.tweens.add({ targets: chip, alpha: 1, duration: 220, delay: 900 + index * 110 });
    });
  }

  /** The winner's victory quote under the round chips. */
  private buildQuote(x: number, y: number, maxWidth: number): void {
    const { winner, depth } = this.options;
    const lore = getFighterLore(winner === 1 ? this.options.p1CharacterId : this.options.p2CharacterId);
    if (!lore) {
      return;
    }

    const quote = this.track(
      this.scene.add
        .text(x, y, `"${lore.winQuote}"`, {
          color: '#fde68a',
          fontFamily: 'monospace',
          fontSize: '20px',
          fontStyle: 'italic',
          align: 'center',
          stroke: '#020617',
          strokeThickness: 4,
          wordWrap: { width: maxWidth }
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(depth + 2)
        .setAlpha(0)
    );
    fitTextToBox(quote, maxWidth, 54, 12, true);
    this.scene.tweens.add({ targets: quote, alpha: 1, duration: 400, delay: 1100 });
  }

  /** Rematch / Main Menu banner buttons with keyboard selection. */
  private buildButtons(x: number, y: number): void {
    const { depth } = this.options;
    const buttonWidth = 270;
    const spacing = buttonWidth / 2 + 16;
    const actions = [
      { label: 'Rematch', run: () => this.options.onRematch() },
      { label: 'Main Menu', run: () => this.options.onMenu() }
    ];

    this.buttons = actions.map((action, index) => {
      const button = createBannerButton(this.scene, {
        x: x + (index === 0 ? -spacing : spacing),
        y,
        width: buttonWidth,
        height: 56,
        label: action.label,
        fontFamily: DISPLAY_FONT,
        onClick: () => this.confirm(index),
        onHover: () => this.select(index)
      });
      button.group.setScrollFactor(0).setDepth(depth + 3).setAlpha(0);
      this.scene.tweens.add({ targets: button.group, alpha: 1, duration: 300, delay: 1200 + index * 100 });
      return button;
    });
    this.actions = actions.map((action) => action.run);
    this.select(0);

    const toggle = (): void => this.select(1 - this.selected);
    const confirm = (): void => this.confirm(this.selected);
    ['keydown-LEFT', 'keydown-RIGHT', 'keydown-A', 'keydown-D', 'keydown-UP', 'keydown-DOWN', 'keydown-W', 'keydown-S'].forEach(
      (event) => this.listen(event, toggle)
    );
    ['keydown-ENTER', 'keydown-SPACE', 'keydown-F'].forEach((event) => this.listen(event, confirm));
  }

  private select(index: number): void {
    this.selected = index;
    this.buttons.forEach((button, buttonIndex) => button.setSelected(buttonIndex === index));
  }

  private confirm(index: number): void {
    if (!this.acceptingInput) {
      return;
    }
    this.select(index);
    this.acceptingInput = false;
    this.actions[index]?.();
  }

  private listen(event: string, handler: () => void): void {
    const guarded = (): void => {
      if (this.acceptingInput) {
        handler();
      }
    };
    this.scene.input.keyboard?.on(event, guarded);
    this.keyHandlers.push([event, guarded]);
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.objects.push(object);
    return object;
  }
}

/**
 * Convert a 24-bit colour integer to a CSS hex string.
 * @param color - The colour as 0xRRGGBB.
 */
function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
