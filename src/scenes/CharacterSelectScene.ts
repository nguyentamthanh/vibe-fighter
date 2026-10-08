import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { getFighterCombat, getFighterStats } from '../game/fighterConfig';
import { getFighterLore } from '../game/lore';
import { createMenuBackdrop, DISPLAY_FONT } from '../game/menuBackdrop';
import {
  computeFighterRatings,
  describeFighterTraits,
  getFighterPlaystyle,
  RATING_MAX,
  type FighterRatings
} from '../game/playstyle';
import { SELECTABLE_ROSTER } from '../game/roster';
import { createSelectionCard, fitTextToBox, type SelectionCard } from '../game/ui';
import { SCENE_KEYS, type MatchMode } from '../game/types';
import { BaseScene } from './BaseScene';

interface CharacterSelectData {
  mode: MatchMode;
  stageId: string;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const P1_COLOR = 0x38bdf8;
const P2_COLOR = 0xf43f5e;
const CARD_MAX_WIDTH = 300;
const CARD_ASPECT = 384 / 300;
const CARD_GAP = 20;
const MARGIN = 40;
// Everything sits between the heading (title + subtitle) and the footer hint.
const CONTENT_TOP = 130;
const CONTENT_BOTTOM = 56;
// Landscape: info panel on the right of the card grid. Portrait: below it.
const PANEL_SIDE_WIDTH = 360;
const PANEL_BOTTOM_HEIGHT = 440;
const PANEL_GAP = 24;
const PANEL_PADDING = 18;
// Largest font sizes of the panel texts that shrink to fit.
const NAME_FONT = 22;
const ORIGIN_FONT = 15;
const BIO_FONT = 15;

const RATING_ROWS: Array<{ key: keyof FighterRatings; label: string; color: number }> = [
  { key: 'power', label: 'POWER', color: 0xef4444 },
  { key: 'defense', label: 'DEFENSE', color: 0x38bdf8 },
  { key: 'speed', label: 'SPEED', color: 0x22c55e },
  { key: 'special', label: 'SPECIAL', color: 0xfacc15 }
];

interface PlayerCursor {
  index: number;
  locked: boolean;
  color: number;
  outline: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

/** The info panel that describes the highlighted fighter: story, play style and ratings. */
interface InfoPanel {
  box: Box;
  background: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  origin: Phaser.GameObjects.Text;
  archetype: Phaser.GameObjects.Text;
  tip: Phaser.GameObjects.Text;
  ratingLabels: Phaser.GameObjects.Text[];
  bars: Phaser.GameObjects.Graphics;
  traits: Phaser.GameObjects.Text;
  bio: Phaser.GameObjects.Text;
}

/**
 * Final step of the Play flow: pick fighters. In 1v1 both players drive their
 * own cursor (P1 = WASD, P2 = arrows) and cannot land on the other's pick. In
 * 1vCPU the player picks freely and the CPU then auto-selects a different
 * fighter. Each confirmation plays a lock-in flash before the match starts.
 * The info panel shows the highlighted fighter's story, play style and 1–5
 * ratings so every pick reads differently.
 */
export class CharacterSelectScene extends BaseScene {
  private mode: MatchMode = '1v1';
  private stageId = '';
  private cards: SelectionCard[] = [];
  private cardPositions: Array<{ x: number; y: number }> = [];
  private cardWidth = CARD_MAX_WIDTH;
  private cardHeight = Math.round(CARD_MAX_WIDTH * CARD_ASPECT);
  private p1!: PlayerCursor;
  private p2!: PlayerCursor;
  private transitioning = false;
  private panel?: InfoPanel;

  constructor() {
    super(SCENE_KEYS.CharacterSelect);
  }

  init(data: CharacterSelectData): void {
    this.mode = data?.mode ?? '1v1';
    this.stageId = data?.stageId ?? '';
  }

  create(): void {
    this.cards = [];
    this.cardPositions = [];
    this.transitioning = false;

    this.markActiveScene(SCENE_KEYS.CharacterSelect);
    this.cameras.main.setBackgroundColor(0x020617);
    createMenuBackdrop(this, { dim: 0.72 });
    this.createHeading(
      'Select Fighter',
      this.mode === '1v1' ? 'P1 = WASD + Space   •   P2 = Arrows + Enter' : 'WASD / Arrows to choose • Enter to confirm'
    );

    const { cardArea, panelArea } = this.computeLayout();
    this.buildCards(cardArea);
    this.panel = this.buildPanel(panelArea);
    this.buildCursors();
    this.registerInput();

    this.createFooterHint('Esc to go back');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cards.forEach((card) => card.destroy());
      this.cards = [];
      this.panel = undefined;
    });
  }

  /**
   * Splits the screen between the card grid and the info panel: side by side on
   * a wide screen, stacked on a tall one.
   */
  private computeLayout(): { cardArea: Box; panelArea: Box } {
    const { width, height } = this.cameras.main;
    const contentHeight = height - CONTENT_TOP - CONTENT_BOTTOM;

    if (width >= height) {
      const panelArea = {
        x: width - MARGIN - PANEL_SIDE_WIDTH,
        y: CONTENT_TOP,
        width: PANEL_SIDE_WIDTH,
        height: contentHeight
      };
      const cardArea = { x: MARGIN, y: CONTENT_TOP, width: panelArea.x - PANEL_GAP - MARGIN, height: contentHeight };
      return { cardArea, panelArea };
    }

    const panelArea = {
      x: MARGIN,
      y: height - CONTENT_BOTTOM - PANEL_BOTTOM_HEIGHT,
      width: width - 2 * MARGIN,
      height: PANEL_BOTTOM_HEIGHT
    };
    const cardArea = { x: MARGIN, y: CONTENT_TOP, width: width - 2 * MARGIN, height: panelArea.y - PANEL_GAP - CONTENT_TOP };
    return { cardArea, panelArea };
  }

  /**
   * Lays the roster out on a grid inside `area`, picking the column count that
   * gives the largest card (ties prefer fewer columns, i.e. balanced rows).
   * Cursor order stays the roster order.
   * @param area - The box the grid must fit in.
   */
  private buildCards(area: Box): void {
    const roster = SELECTABLE_ROSTER;
    const fitCard = (columns: number): number => {
      const rowCount = Math.ceil(roster.length / columns);
      const byWidth = (area.width - CARD_GAP * (columns - 1)) / columns;
      const byHeight = (area.height - CARD_GAP * (rowCount - 1)) / rowCount / CARD_ASPECT;
      return Math.floor(Math.min(CARD_MAX_WIDTH, byWidth, byHeight));
    };
    let columns = 1;
    for (let candidate = 2; candidate <= roster.length; candidate++) {
      if (fitCard(candidate) > fitCard(columns)) {
        columns = candidate;
      }
    }
    const rows = Math.ceil(roster.length / columns);

    this.cardWidth = fitCard(columns);
    this.cardHeight = Math.round(this.cardWidth * CARD_ASPECT);
    const plateHeight = Phaser.Math.Clamp(Math.round(this.cardWidth * 0.2), 24, 44);
    const imageSize = Math.min(this.cardWidth - 14, this.cardHeight - plateHeight - 14);
    const centerX = area.x + area.width / 2;
    const totalHeight = rows * this.cardHeight + (rows - 1) * CARD_GAP;
    const firstY = area.y + (area.height - totalHeight) / 2 + this.cardHeight / 2;

    roster.forEach((character, index) => {
      const row = Math.floor(index / columns);
      const inRow = Math.min(columns, roster.length - row * columns);
      const rowWidth = inRow * this.cardWidth + (inRow - 1) * CARD_GAP;
      const x = centerX - rowWidth / 2 + this.cardWidth / 2 + (index % columns) * (this.cardWidth + CARD_GAP);
      const y = firstY + row * (this.cardHeight + CARD_GAP);
      this.cardPositions.push({ x, y });

      const card = createSelectionCard(this, {
        x,
        y,
        width: this.cardWidth,
        height: this.cardHeight,
        title: character.label,
        texture: this.textures.exists(character.portrait.key) ? character.portrait.key : undefined,
        imageMaxSize: imageSize,
        imageOffsetY: Math.round(-plateHeight / 2),
        namePlateHeight: plateHeight,
        onHover: () => this.hoverCard(index),
        onClick: () => this.clickCard(index)
      });

      this.cards.push(card);
    });
  }

  /**
   * Creates the info panel objects; their text and positions are filled in by {@link updatePanel}.
   * @param box - Where the panel goes.
   */
  private buildPanel(box: Box): InfoPanel {
    const depth = 30;
    const textWidth = box.width - 2 * PANEL_PADDING;
    const text = (style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text =>
      this.add
        .text(0, 0, '', { stroke: '#020617', strokeThickness: 3, ...style })
        .setOrigin(0, 0)
        .setDepth(depth + 1);

    const background = this.add
      .rectangle(box.x + box.width / 2, box.y + box.height / 2, box.width, box.height, 0x0f172a, 0.88)
      .setStrokeStyle(2, P1_COLOR, 1)
      .setDepth(depth);

    return {
      box,
      background,
      name: text({ color: '#fde68a', fontFamily: DISPLAY_FONT, fontSize: `${NAME_FONT}px`, strokeThickness: 5 }),
      origin: text({ color: '#94a3b8', fontFamily: 'monospace', fontSize: `${ORIGIN_FONT}px` }),
      archetype: text({
        color: '#020617',
        fontFamily: DISPLAY_FONT,
        fontSize: '15px',
        strokeThickness: 0,
        padding: { x: 10, y: 5 }
      }),
      tip: text({ color: '#f8fafc', fontFamily: 'monospace', fontSize: '16px', wordWrap: { width: textWidth } }),
      ratingLabels: RATING_ROWS.map((row) =>
        text({ color: colorToCss(row.color), fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold' })
      ),
      bars: this.add.graphics().setDepth(depth + 1),
      traits: text({
        color: '#fde68a',
        fontFamily: 'monospace',
        fontSize: '14px',
        lineSpacing: 4,
        wordWrap: { width: textWidth }
      }),
      bio: text({ color: '#cbd5e1', fontFamily: 'monospace', fontSize: `${BIO_FONT}px`, wordWrap: { width: textWidth } })
    };
  }

  /**
   * Fills the info panel with the fighter under a cursor, stacking each block
   * under the previous one and shrinking the bio if it would overflow.
   * @param cursor - The cursor whose fighter to describe.
   */
  private updatePanel(cursor: PlayerCursor): void {
    const panel = this.panel;
    const character = SELECTABLE_ROSTER[cursor.index];
    if (!panel || !character) {
      return;
    }

    const lore = getFighterLore(character.id);
    const playstyle = getFighterPlaystyle(character.id);
    const tuning = this.app.debugStore.getState().fighterPlayground;
    const combat = getFighterCombat(tuning, character.id);
    const ratings = computeFighterRatings(getFighterStats(tuning, character.id), combat, playstyle?.specialHits);
    const { box } = panel;
    const left = box.x + PANEL_PADDING;
    const textWidth = box.width - 2 * PANEL_PADDING;
    const bottom = box.y + box.height - PANEL_PADDING;
    let y = box.y + PANEL_PADDING;

    panel.background.setStrokeStyle(2, cursor.color, 1);

    panel.name.setText((lore?.name ?? character.label).toUpperCase()).setFontSize(NAME_FONT);
    fitTextToBox(panel.name, textWidth, 56, 11);
    panel.name.setPosition(left, y);
    y += panel.name.height + 6;

    panel.origin.setText(lore ? `${lore.origin}  •  ${lore.style}` : '').setFontSize(ORIGIN_FONT);
    fitTextToBox(panel.origin, textWidth, 36, 10);
    panel.origin.setPosition(left, y);
    y += panel.origin.height + 12;

    panel.archetype
      .setText((playstyle?.archetype ?? 'Fighter').toUpperCase())
      .setBackgroundColor(colorToCss(playstyle?.color ?? 0x94a3b8))
      .setPosition(left, y);
    y += panel.archetype.height + 8;

    panel.tip.setText(playstyle?.tip ?? '').setPosition(left, y);
    y += panel.tip.height + 12;

    const labelWidth = 92;
    const segmentGap = 5;
    const segmentWidth = Math.min(40, (textWidth - labelWidth - segmentGap * (RATING_MAX - 1)) / RATING_MAX);
    const segmentHeight = 14;
    panel.bars.clear();
    RATING_ROWS.forEach((row, rowIndex) => {
      const value = ratings[row.key];
      const label = panel.ratingLabels[rowIndex];
      label.setText(row.label).setPosition(left, y);
      const barY = y + (label.height - segmentHeight) / 2;

      for (let segment = 0; segment < RATING_MAX; segment++) {
        const segmentX = left + labelWidth + segment * (segmentWidth + segmentGap);
        const filled = segment < value;
        panel.bars.fillStyle(filled ? row.color : 0x1e293b, filled ? 1 : 0.9);
        panel.bars.fillRect(segmentX, barY, segmentWidth, segmentHeight);
        panel.bars.lineStyle(1, 0x020617, 1);
        panel.bars.strokeRect(segmentX, barY, segmentWidth, segmentHeight);
      }

      y += Math.max(label.height, segmentHeight) + 10;
    });

    const traits = describeFighterTraits(combat);
    panel.traits.setText(traits.map((trait) => `+ ${trait}`).join('\n')).setPosition(left, y + 2);
    y += traits.length > 0 ? panel.traits.height + 16 : 8;

    panel.bio.setText(lore?.bio ?? '').setFontSize(BIO_FONT).setPosition(left, y);
    fitTextToBox(panel.bio, textWidth, Math.max(16, bottom - y), 10, true);
  }

  private buildCursors(): void {
    this.p1 = this.createCursor('P1', P1_COLOR, 0);
    const p2Start = this.mode === '1v1' ? Math.min(1, this.cards.length - 1) : 0;
    this.p2 = this.createCursor('P2', P2_COLOR, p2Start);

    if (this.mode === '1vcpu') {
      this.p2.outline.setVisible(false);
      this.p2.label.setVisible(false);
    }

    this.refreshCursor(this.p1);
    this.refreshCursor(this.p2);
    this.updatePanel(this.p1);
  }

  private createCursor(label: string, color: number, index: number): PlayerCursor {
    const outline = this.add
      .rectangle(0, 0, this.cardWidth + 12, this.cardHeight + 12, color, 0)
      .setStrokeStyle(4, color, 1)
      .setDepth(20);

    const text = this.add
      .text(0, 0, label, {
        color: '#020617',
        backgroundColor: colorToCss(color),
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        padding: { x: 6, y: 2 }
      })
      .setOrigin(0, 0)
      .setDepth(21);

    return { index, locked: false, color, outline, label: text };
  }

  private refreshCursor(cursor: PlayerCursor): void {
    const position = this.cardPositions[cursor.index];
    if (!position) {
      return;
    }

    cursor.outline.setPosition(position.x, position.y);
    cursor.outline.setStrokeStyle(cursor.locked ? 7 : 4, cursor.color, 1);
    // The tag sits inside the card's top-left corner so it never covers the row above.
    cursor.label.setPosition(position.x - this.cardWidth / 2 + 4, position.y - this.cardHeight / 2 + 4);

    // The panel follows the player who moved (the CPU's pick in 1vCPU does not replace the player's panel).
    if (cursor === this.p1 || this.mode === '1v1') {
      this.updatePanel(cursor);
    }
  }

  private registerInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    if (this.mode === '1v1') {
      keyboard.on('keydown-A', () => this.movePlayer(this.p1, -1));
      keyboard.on('keydown-D', () => this.movePlayer(this.p1, 1));
      keyboard.on('keydown-LEFT', () => this.movePlayer(this.p2, -1));
      keyboard.on('keydown-RIGHT', () => this.movePlayer(this.p2, 1));
      keyboard.on('keydown-SPACE', () => this.confirmPlayer(this.p1));
      keyboard.on('keydown-F', () => this.confirmPlayer(this.p1));
      keyboard.on('keydown-ENTER', () => this.confirmPlayer(this.p2));
    } else {
      const moveLeft = (): void => this.movePlayer(this.p1, -1);
      const moveRight = (): void => this.movePlayer(this.p1, 1);
      keyboard.on('keydown-A', moveLeft);
      keyboard.on('keydown-LEFT', moveLeft);
      keyboard.on('keydown-D', moveRight);
      keyboard.on('keydown-RIGHT', moveRight);
      keyboard.on('keydown-SPACE', () => this.confirmPlayer(this.p1));
      keyboard.on('keydown-F', () => this.confirmPlayer(this.p1));
      keyboard.on('keydown-ENTER', () => this.confirmPlayer(this.p1));
    }

    keyboard.on('keydown-ESC', () => this.goBack());
    keyboard.on('keydown-BACKSPACE', () => this.goBack());
  }

  /**
   * Moves a player's cursor by one step. The two players can never select the
   * same fighter: when a move would land on the other player's card the cursor
   * hops over it if a free card exists, otherwise (e.g. only two fighters) the
   * two players simply swap picks.
   * @param cursor - The player cursor to move.
   * @param direction - -1 for left, +1 for right.
   */
  private movePlayer(cursor: PlayerCursor, direction: number): void {
    if (this.transitioning || cursor.locked) {
      return;
    }

    const count = this.cards.length;
    const other = this.otherCursor(cursor);
    let next = Phaser.Math.Wrap(cursor.index + direction, 0, count);

    if (this.mode === '1v1' && next === other.index) {
      const skip = Phaser.Math.Wrap(next + direction, 0, count);

      if (skip !== cursor.index) {
        next = skip;
      } else if (!other.locked) {
        other.index = cursor.index;
        cursor.index = next;
        this.refreshCursor(cursor);
        this.refreshCursor(other);
        return;
      } else {
        return;
      }
    }

    cursor.index = next;
    this.refreshCursor(cursor);
  }

  private otherCursor(cursor: PlayerCursor): PlayerCursor {
    return cursor === this.p1 ? this.p2 : this.p1;
  }

  private hoverCard(index: number): void {
    if (this.transitioning || this.mode !== '1vcpu' || this.p1.locked) {
      return;
    }

    this.p1.index = index;
    this.refreshCursor(this.p1);
  }

  private clickCard(index: number): void {
    if (this.transitioning) {
      return;
    }

    if (this.mode === '1vcpu') {
      this.p1.index = index;
      this.refreshCursor(this.p1);
      this.confirmPlayer(this.p1);
    }
  }

  /**
   * Locks a player's current pick with a flash. In 1v1 the match starts once
   * both players have locked; in 1vCPU locking the player triggers the CPU pick.
   * @param cursor - The player cursor confirming its selection.
   */
  private confirmPlayer(cursor: PlayerCursor): void {
    if (this.transitioning || cursor.locked) {
      return;
    }

    cursor.locked = true;
    this.refreshCursor(cursor);
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());

    this.cards[cursor.index].flashLock(() => {
      if (this.mode === '1vcpu') {
        this.runCpuSelection();
        return;
      }

      if (this.p1.locked && this.p2.locked) {
        this.startMatch();
      }
    });
  }

  private runCpuSelection(): void {
    if (this.transitioning) {
      return;
    }

    this.transitioning = true;

    const choices = this.cards.map((_, index) => index).filter((index) => index !== this.p1.index);
    const cpuIndex = choices.length > 0 ? Phaser.Math.RND.pick(choices) : this.p1.index;

    this.p2.index = cpuIndex;
    this.p2.outline.setVisible(true);
    this.p2.label.setVisible(true);
    this.p2.label.setText('CPU');
    this.refreshCursor(this.p2);

    this.time.delayedCall(450, () => {
      this.p2.locked = true;
      this.refreshCursor(this.p2);
      playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
      this.cards[cpuIndex].flashLock(() => this.startMatch());
    });
  }

  private startMatch(): void {
    if (this.transitioning && this.mode === '1v1') {
      return;
    }

    this.transitioning = true;
    const roster = SELECTABLE_ROSTER;

    this.scene.start(SCENE_KEYS.Match, {
      mode: this.mode,
      stageId: this.stageId,
      p1CharacterId: roster[this.p1.index].id,
      p2CharacterId: roster[this.p2.index].id
    });
  }

  private goBack(): void {
    if (this.transitioning) {
      return;
    }

    this.scene.start(SCENE_KEYS.LevelSelect, { mode: this.mode });
  }
}

/**
 * Convert a 24-bit colour integer to a CSS hex string.
 * @param color - The colour as 0xRRGGBB.
 */
function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
