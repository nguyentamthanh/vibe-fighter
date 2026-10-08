import * as Phaser from 'phaser';

export interface TextButton {
  group: Phaser.GameObjects.Container;
  setSelected(selected: boolean): void;
  destroy(): void;
}

interface TextButtonConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick(): void;
  onHover?(): void;
}

export function createTextButton(scene: Phaser.Scene, config: TextButtonConfig): TextButton {
  const background = scene.add.image(config.x, config.y, 'ui-button');
  const label = scene.add.text(config.x, config.y, config.label, {
    color: '#e2e8f0',
    fontFamily: 'monospace',
    fontSize: '22px'
  });

  background.setDisplaySize(config.width, config.height);
  background.setInteractive({ useHandCursor: true });
  label.setOrigin(0.5);

  const group = scene.add.container(0, 0, [background, label]);

  const setSelected = (selected: boolean): void => {
    background.setTexture(selected ? 'ui-button-active' : 'ui-button');
    label.setColor(selected ? '#f8fafc' : '#e2e8f0');
  };

  background.on('pointerover', () => {
    config.onHover?.();
  });
  background.on('pointerdown', () => {
    config.onClick();
  });

  setSelected(false);

  return {
    group,
    setSelected,
    destroy: () => {
      group.destroy(true);
    }
  };
}

export interface BannerButtonConfig extends TextButtonConfig {
  /** Font family for the label (the arcade display font on the title screen). */
  fontFamily: string;
}

const BANNER_SKEW = 18;

/**
 * Create a slanted, arcade-style menu button: a dark glass panel that turns
 * into a glowing orange banner with pulsing arrows while selected.
 * @param scene - The owning scene.
 * @param config - Geometry, label, font and callbacks.
 * @returns A {@link TextButton} handle.
 */
export function createBannerButton(scene: Phaser.Scene, config: BannerButtonConfig): TextButton {
  const { width, height } = config;
  const panel = scene.add.graphics();
  const label = scene.add
    .text(0, 1, config.label.toUpperCase(), {
      color: '#cbd5e1',
      fontFamily: config.fontFamily,
      fontSize: '20px',
      stroke: '#020617',
      strokeThickness: 5
    })
    .setOrigin(0.5);
  const arrowStyle = { color: '#fde047', fontFamily: config.fontFamily, fontSize: '18px', stroke: '#7c2d12', strokeThickness: 5 };
  const leftArrow = scene.add.text(-width / 2 + 34, 1, '▶', arrowStyle).setOrigin(0.5);
  const rightArrow = scene.add.text(width / 2 - 34, 1, '◀', arrowStyle).setOrigin(0.5);
  const hitArea = scene.add.rectangle(0, 0, width, height, 0x000000, 0.001);

  const group = scene.add.container(config.x, config.y, [panel, label, leftArrow, rightArrow, hitArea]);
  let arrowTweens: Phaser.Tweens.Tween[] = [];

  const outline = (inset: number): Phaser.Math.Vector2[] => [
    new Phaser.Math.Vector2(-width / 2 + BANNER_SKEW + inset, -height / 2 + inset),
    new Phaser.Math.Vector2(width / 2 - inset, -height / 2 + inset),
    new Phaser.Math.Vector2(width / 2 - BANNER_SKEW - inset, height / 2 - inset),
    new Phaser.Math.Vector2(-width / 2 + inset, height / 2 - inset)
  ];

  const draw = (selected: boolean): void => {
    panel.clear();

    if (selected) {
      // Soft outer glow, then the hot orange-to-red banner with a gold rim and a light band on top.
      panel.fillStyle(0xf97316, 0.25);
      panel.fillPoints(outline(-6), true);
      panel.fillGradientStyle(0xfb923c, 0xf97316, 0xdc2626, 0xb91c1c, 1, 1, 1, 1);
      panel.fillPoints(outline(0), true);
      panel.fillStyle(0xffffff, 0.18);
      panel.fillRect(-width / 2 + BANNER_SKEW + 6, -height / 2 + 5, width - BANNER_SKEW * 2 - 6, 6);
      panel.lineStyle(3, 0xfde047, 1);
      panel.strokePoints(outline(0), true);
    } else {
      panel.fillStyle(0x0b1120, 0.82);
      panel.fillPoints(outline(0), true);
      panel.lineStyle(2, 0x64748b, 0.9);
      panel.strokePoints(outline(0), true);
    }
  };

  const setSelected = (selected: boolean): void => {
    draw(selected);
    label.setColor(selected ? '#ffffff' : '#cbd5e1');
    leftArrow.setVisible(selected);
    rightArrow.setVisible(selected);
    arrowTweens.forEach((tween) => tween.stop());
    arrowTweens = [];
    leftArrow.x = -width / 2 + 34;
    rightArrow.x = width / 2 - 34;
    scene.tweens.add({ targets: group, scale: selected ? 1.06 : 1, duration: 140, ease: 'Back.easeOut' });

    if (selected) {
      const nudge = { duration: 420, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 };
      arrowTweens = [
        scene.tweens.add({ targets: leftArrow, x: leftArrow.x + 8, ...nudge }),
        scene.tweens.add({ targets: rightArrow, x: rightArrow.x - 8, ...nudge })
      ];
    }
  };

  hitArea.setInteractive({ useHandCursor: true });
  hitArea.on('pointerover', () => config.onHover?.());
  hitArea.on('pointerdown', () => config.onClick());

  setSelected(false);

  return {
    group,
    setSelected,
    destroy: () => {
      arrowTweens.forEach((tween) => tween.stop());
      group.destroy(true);
    }
  };
}

export interface SelectionCard {
  container: Phaser.GameObjects.Container;
  setSelected(selected: boolean, accent?: number): void;
  setDimmed(dimmed: boolean): void;
  flashLock(onComplete: () => void): void;
  destroy(): void;
}

export interface SelectionCardConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  texture?: string;
  /** Max width/height (px) for the card image; defaults to fitting the card. */
  imageMaxSize?: number;
  /** Vertical offset of the image centre from the card centre. */
  imageOffsetY?: number;
  /**
   * Draw the title inside a name plate along the card's bottom edge (height in
   * px). The title shrinks to fit the plate. Without it the title floats under the image.
   */
  namePlateHeight?: number;
  onClick?: () => void;
  onHover?: () => void;
}

const CARD_BASE_STROKE = 0x334155;

/**
 * Shrinks a text object's font until it fits a box. Single-line mode tries one
 * line first and only wraps if even the smallest font is too wide; `wrap` mode
 * (paragraphs) wraps at `maxWidth` and shrinks until the height fits.
 * @param text - The text object (its current font size is the largest allowed).
 * @param maxWidth - The width it must fit in (px).
 * @param maxHeight - The height it must fit in (px).
 * @param minFontSize - The smallest font size to try (px).
 * @param wrap - Whether the text is a wrapped paragraph.
 */
export function fitTextToBox(
  text: Phaser.GameObjects.Text,
  maxWidth: number,
  maxHeight: number,
  minFontSize = 9,
  wrap = false
): void {
  let size = parseInt(String(text.style.fontSize), 10) || 16;

  text.setWordWrapWidth(wrap ? maxWidth : null, true);
  while (size > minFontSize && (text.width > maxWidth || text.height > maxHeight)) {
    size -= 1;
    text.setFontSize(size);
  }

  if (text.width > maxWidth) {
    text.setWordWrapWidth(maxWidth, true);
  }
}

/**
 * Create a selectable card: a framed panel with an optional image, a title and
 * subtitle, plus selection highlighting and a lock-in flash. Used by the level
 * and character select screens.
 * @param scene - The owning scene.
 * @param config - Card geometry, labels, optional image, and callbacks.
 * @returns A {@link SelectionCard} handle.
 */
export function createSelectionCard(scene: Phaser.Scene, config: SelectionCardConfig): SelectionCard {
  const background = scene.add
    .rectangle(0, 0, config.width, config.height, 0x0f172a, 0.92)
    .setStrokeStyle(2, CARD_BASE_STROKE, 1);

  const children: Phaser.GameObjects.GameObject[] = [background];

  if (config.texture) {
    const image = scene.add.image(0, config.imageOffsetY ?? -18, config.texture).setOrigin(0.5);
    const maxSize = config.imageMaxSize ?? Math.min(config.width - 24, config.height - 80);
    const sourceSize = Math.max(image.width, image.height) || maxSize;
    image.setScale(maxSize / sourceSize);
    children.push(image);
  }

  const subtitleY = config.height / 2 - 20;
  const plateHeight = config.namePlateHeight ?? 0;
  const titleY = plateHeight > 0 ? config.height / 2 - plateHeight / 2 : config.subtitle ? subtitleY - 26 : subtitleY;

  if (plateHeight > 0) {
    const plate = scene.add
      .rectangle(0, titleY, config.width - 8, plateHeight - 6, 0x020617, 0.9)
      .setStrokeStyle(1, 0x475569, 1);
    children.push(plate);
  }

  const title = scene.add
    .text(0, titleY, config.title, {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: plateHeight > 0 ? `${Math.min(20, Math.round(plateHeight * 0.55))}px` : '20px',
      fontStyle: plateHeight > 0 ? 'bold' : 'normal',
      align: 'center'
    })
    .setOrigin(0.5);
  if (plateHeight > 0) {
    fitTextToBox(title, config.width - 20, plateHeight - 8);
  }
  children.push(title);

  if (config.subtitle) {
    const subtitle = scene.add
      .text(0, subtitleY, config.subtitle, {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: '13px',
        align: 'center'
      })
      .setOrigin(0.5);
    children.push(subtitle);
  }

  const flash = scene.add
    .rectangle(0, 0, config.width, config.height, 0xffffff, 0)
    .setOrigin(0.5);
  children.push(flash);

  const container = scene.add.container(config.x, config.y, children);

  background.setInteractive({ useHandCursor: true });
  background.on('pointerover', () => config.onHover?.());
  background.on('pointerdown', () => config.onClick?.());

  const setSelected = (selected: boolean, accent: number = 0x38bdf8): void => {
    background.setStrokeStyle(selected ? 4 : 2, selected ? accent : CARD_BASE_STROKE, 1);
    container.setScale(selected ? 1.05 : 1);
    title.setColor(selected ? '#ffffff' : '#f8fafc');
  };

  const setDimmed = (dimmed: boolean): void => {
    container.setAlpha(dimmed ? 0.4 : 1);
  };

  const flashLock = (onComplete: () => void): void => {
    scene.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.85 },
      duration: 90,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        flash.setAlpha(0);
        onComplete();
      }
    });
  };

  setSelected(false);

  return {
    container,
    setSelected,
    setDimmed,
    flashLock,
    destroy: () => {
      container.destroy(true);
    }
  };
}
