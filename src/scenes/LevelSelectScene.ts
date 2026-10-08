import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { createMenuBackdrop } from '../game/menuBackdrop';
import { STAGE_DEFINITIONS } from '../game/stageConfig';
import { createSelectionCard, type SelectionCard } from '../game/ui';
import { SCENE_KEYS, type MatchMode } from '../game/types';
import { BaseScene } from './BaseScene';

interface LevelSelectData {
  mode: MatchMode;
}

const ACCENT = 0xfacc15;
const CARD_MAX_WIDTH = 420;
// Card height / width: a 2:1 stage thumbnail plus the name plate.
const CARD_ASPECT = 0.68;
const CARD_GAP = 24;
const MARGIN = 40;
const CONTENT_TOP = 130;
// Leaves room under the bottom row for the selected card's 5% zoom above the footer hint.
const CONTENT_BOTTOM = 72;

/**
 * Second step of the Play flow: pick the stage for the match. Shows each stage
 * as a thumbnail card and forwards the selection to character select.
 */
export class LevelSelectScene extends BaseScene {
  private mode: MatchMode = '1v1';
  private cards: SelectionCard[] = [];
  private selectedIndex = 0;
  private columns = 1;

  constructor() {
    super(SCENE_KEYS.LevelSelect);
  }

  init(data: LevelSelectData): void {
    this.mode = data?.mode ?? '1v1';
  }

  create(): void {
    this.cards = [];
    this.selectedIndex = 0;

    this.markActiveScene(SCENE_KEYS.LevelSelect);
    this.cameras.main.setBackgroundColor(0x020617);
    createMenuBackdrop(this, { dim: 0.72 });
    this.createHeading('Select Stage', this.mode === '1v1' ? '1 vs 1' : '1 vs CPU');

    this.buildCards();
    this.registerInput();
    this.setSelection(0);

    this.createFooterHint('Arrows / WASD to choose • Enter / Space to confirm • Esc to go back');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cards.forEach((card) => card.destroy());
      this.cards = [];
    });
  }

  /**
   * Lays the stages out on a grid between the heading and the footer, picking
   * the column count that gives the largest card (ties prefer fewer columns).
   */
  private buildCards(): void {
    const { centerX, width, height } = this.cameras.main;
    const stages = STAGE_DEFINITIONS;
    const areaWidth = width - 2 * MARGIN;
    const areaHeight = height - CONTENT_TOP - CONTENT_BOTTOM;
    const fitCard = (columns: number): number => {
      const rowCount = Math.ceil(stages.length / columns);
      const byWidth = (areaWidth - CARD_GAP * (columns - 1)) / columns;
      const byHeight = (areaHeight - CARD_GAP * (rowCount - 1)) / rowCount / CARD_ASPECT;
      return Math.floor(Math.min(CARD_MAX_WIDTH, byWidth, byHeight));
    };
    let columns = 1;
    for (let candidate = 2; candidate <= stages.length; candidate++) {
      if (fitCard(candidate) > fitCard(columns)) {
        columns = candidate;
      }
    }
    this.columns = columns;

    const cardWidth = fitCard(columns);
    const cardHeight = Math.round(cardWidth * CARD_ASPECT);
    const plateHeight = Phaser.Math.Clamp(Math.round(cardWidth * 0.11), 26, 44);
    const rows = Math.ceil(stages.length / columns);
    const totalHeight = rows * cardHeight + (rows - 1) * CARD_GAP;
    const firstY = CONTENT_TOP + (areaHeight - totalHeight) / 2 + cardHeight / 2;

    stages.forEach((stage, index) => {
      const row = Math.floor(index / columns);
      const inRow = Math.min(columns, stages.length - row * columns);
      const rowWidth = inRow * cardWidth + (inRow - 1) * CARD_GAP;
      const card = createSelectionCard(this, {
        x: centerX - rowWidth / 2 + cardWidth / 2 + (index % columns) * (cardWidth + CARD_GAP),
        y: firstY + row * (cardHeight + CARD_GAP),
        width: cardWidth,
        height: cardHeight,
        title: stage.label,
        texture: this.textures.exists(stage.key) ? stage.key : undefined,
        imageMaxSize: cardWidth - 16,
        imageOffsetY: Math.round(-plateHeight / 2),
        namePlateHeight: plateHeight,
        onHover: () => this.setSelection(index),
        onClick: () => this.confirm(index)
      });

      this.cards.push(card);
    });
  }

  private registerInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.on('keydown-LEFT', () => this.moveSelection(-1));
    keyboard.on('keydown-A', () => this.moveSelection(-1));
    keyboard.on('keydown-RIGHT', () => this.moveSelection(1));
    keyboard.on('keydown-D', () => this.moveSelection(1));
    keyboard.on('keydown-UP', () => this.moveSelection(-this.columns));
    keyboard.on('keydown-W', () => this.moveSelection(-this.columns));
    keyboard.on('keydown-DOWN', () => this.moveSelection(this.columns));
    keyboard.on('keydown-S', () => this.moveSelection(this.columns));
    keyboard.on('keydown-ENTER', () => this.confirm(this.selectedIndex));
    keyboard.on('keydown-SPACE', () => this.confirm(this.selectedIndex));
    keyboard.on('keydown-ESC', () => this.scene.start(SCENE_KEYS.ModeSelect));
    keyboard.on('keydown-BACKSPACE', () => this.scene.start(SCENE_KEYS.ModeSelect));
  }

  private moveSelection(direction: number): void {
    const next = Phaser.Math.Wrap(this.selectedIndex + direction, 0, this.cards.length);
    this.setSelection(next);
  }

  private setSelection(index: number): void {
    this.selectedIndex = index;
    this.cards.forEach((card, cardIndex) => card.setSelected(cardIndex === index, ACCENT));
  }

  private confirm(index: number): void {
    this.setSelection(index);
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
    this.scene.start(SCENE_KEYS.CharacterSelect, {
      mode: this.mode,
      stageId: STAGE_DEFINITIONS[index].id
    });
  }
}
