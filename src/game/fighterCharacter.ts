import type { ImageAsset, SpritesheetAsset } from './assets';
import type { CharacterDefinition, HeroAnimationDefinition, HeroBoundsFrame } from './hero';
import type { Rect } from './types';

const FRAME_WIDTH = 256;
const FRAME_HEIGHT = 256;
const SHEET_BASE = {
  kind: 'spritesheet' as const,
  frameWidth: FRAME_WIDTH,
  frameHeight: FRAME_HEIGHT,
  margin: 0,
  spacing: 0
};

const WEST_ANCHOR = { x: 0.5, y: 0.99609375 };
const WEST_ANCHOR_PIXELS = { x: 128, y: 255 };

/**
 * Per-action authoring metadata for a fighter: source spritesheet file, frame
 * count, playback rate, a default visual bounding box, and optional
 * attack-active frames. Bounds are placeholders refined in the Character Gym.
 */
export interface FighterActionSpec {
  action: string;
  label: string;
  file: string;
  frames: number;
  frameRate: number;
  repeat: number;
  defaultVisual: Rect;
  attack?: { frames: number[]; bounds: Rect };
  /**
   * Multiple distinct attack windows within one animation (each separated by
   * inactive frames). Used by specials so a single move lands several hits — the
   * combat layer treats every active span as its own connectable hit.
   */
  attackSpans?: { frames: number[]; bounds: Rect }[];
  guard?: Rect;
}

/**
 * Declarative description of a generated fighter: its id/label, where its public
 * spritesheets live, and the ordered action set to register.
 */
export interface FighterCharacterConfig {
  id: string;
  label: string;
  role?: CharacterDefinition['role'];
  assetRoot: string;
  anchorUsage: string;
  anchorFile?: string;
  portraitFile?: string;
  /**
   * Sprite frame width in px (default 256). Wider frames give long weapons room
   * in front of the body; the feet stay centred (anchor x 0.5) and frame height
   * stays 256.
   */
  frameWidth?: number;
  actions: FighterActionSpec[];
}

/**
 * Build a complete `CharacterDefinition` (anchor + spritesheets + animations
 * with seeded per-frame bounds) for a generated fighter from its config.
 * @param config - The fighter's id, asset root, and per-action specs.
 */
export function buildFighterCharacter(config: FighterCharacterConfig): CharacterDefinition {
  const anchorAsset: ImageAsset = {
    kind: 'image',
    key: `${config.id}-anchor-w`,
    url: `${config.assetRoot}/${config.anchorFile ?? 'anchor-w.png'}`,
    width: 1024,
    height: 1024,
    usage: config.anchorUsage
  };

  const portrait: ImageAsset = {
    kind: 'image',
    key: `${config.id}-portrait`,
    url: `${config.assetRoot}/${config.portraitFile ?? 'portrait.png'}`,
    width: 1254,
    height: 1254,
    usage: `${config.label.toLowerCase()} character-select portrait`
  };

  const frameWidth = config.frameWidth ?? FRAME_WIDTH;

  const spritesheets: SpritesheetAsset[] = config.actions.map((spec) =>
    sheet(animationKey(config.id, spec.action), `${config.assetRoot}/${spec.file}`, spec.frames, frameWidth)
  );

  const animations: HeroAnimationDefinition[] = config.actions.map((spec) =>
    makeAnimation(config.id, spec, requireSheet(spritesheets, animationKey(config.id, spec.action)))
  );

  return {
    id: config.id,
    label: config.label,
    role: config.role ?? 'player',
    anchor: WEST_ANCHOR,
    anchorPixels: { ...WEST_ANCHOR_PIXELS, x: frameWidth / 2 },
    animations,
    anchorAsset,
    portrait,
    assets: [anchorAsset, portrait, ...spritesheets]
  };
}

/**
 * Derive the canonical animation key for a fighter action (e.g. `green-boxer-idle`).
 * @param characterId - The owning character id.
 * @param action - The action name.
 */
export function animationKey(characterId: string, action: string): string {
  return `${characterId}-${action}`;
}

/**
 * Construct a rectangle literal.
 * @param x - Left edge in frame pixels.
 * @param y - Top edge in frame pixels.
 * @param width - Width in pixels.
 * @param height - Height in pixels.
 */
export function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

/**
 * Build a spritesheet asset descriptor (256px tall frames, 256px wide by default).
 * @param key - Loader/animation key.
 * @param url - Public URL of the spritesheet.
 * @param frames - Frame count in the sheet.
 * @param frameWidth - Frame width in px.
 */
function sheet(key: string, url: string, frames: number, frameWidth: number): SpritesheetAsset {
  return { ...SHEET_BASE, frameWidth, key, url, frames };
}

/**
 * Build a hero animation definition from an action spec, seeding placeholder
 * collision/hit boxes from the default visual box and attack boxes on the
 * spec's active frames.
 * @param characterId - The owning character id.
 * @param spec - The action authoring metadata.
 * @param animationSheet - The resolved spritesheet descriptor for this action.
 */
function makeAnimation(
  characterId: string,
  spec: FighterActionSpec,
  animationSheet: SpritesheetAsset
): HeroAnimationDefinition {
  const key = animationKey(characterId, spec.action);
  const attackByFrame = buildAttackByFrame(spec);
  const frameWidth = animationSheet.frameWidth;

  const bounds: HeroBoundsFrame[] = Array.from({ length: spec.frames }, (_, frame) => ({
    frame,
    visual: { ...spec.defaultVisual },
    collision: collisionBounds(spec.defaultVisual, frameWidth),
    hit: hitBounds(spec.defaultVisual, frameWidth),
    attack: attackByFrame.get(frame) ?? null,
    guard: spec.guard ? { ...spec.guard } : null
  }));

  return {
    id: key,
    characterId,
    action: spec.action,
    label: spec.label,
    key,
    sheet: animationSheet,
    frameRate: spec.frameRate,
    repeat: spec.repeat,
    bounds
  };
}

/**
 * Build a frame -> attack-rect map from an action's single attack window and/or
 * its multi-window `attackSpans` (later spans win on overlapping frames).
 * @param spec - The action authoring metadata.
 */
function buildAttackByFrame(spec: FighterActionSpec): Map<number, Rect> {
  const attackByFrame = new Map<number, Rect>();

  if (spec.attack) {
    spec.attack.frames.forEach((frame) => attackByFrame.set(frame, spec.attack!.bounds));
  }

  (spec.attackSpans ?? []).forEach((span) => {
    span.frames.forEach((frame) => attackByFrame.set(frame, span.bounds));
  });

  return attackByFrame;
}

/**
 * Look up the spritesheet descriptor for an animation key, throwing if missing.
 * @param sheets - Candidate spritesheets.
 * @param key - The animation key to resolve.
 */
function requireSheet(sheets: SpritesheetAsset[], key: string): SpritesheetAsset {
  const found = sheets.find((candidate) => candidate.key === key);

  if (!found) {
    throw new Error(`Missing fighter spritesheet metadata for ${key}`);
  }

  return found;
}

/**
 * Derive a centered collision box from a visual box, anchored to the feet.
 * @param visual - The visual bounding box.
 * @param frameWidth - Frame width in px; the feet sit at its centre.
 */
function collisionBounds(visual: Rect, frameWidth: number): Rect {
  const width = Math.min(58, Math.max(34, Math.round(visual.width * 0.46)));
  const height = Math.max(74, Math.round(visual.height * 0.82));

  return {
    x: Math.round(frameWidth / 2 - width / 2),
    y: Math.round(230 - height),
    width,
    height
  };
}

/**
 * Derive a slightly padded hurtbox from a visual box.
 * @param visual - The visual bounding box.
 * @param frameWidth - Frame width in px.
 */
function hitBounds(visual: Rect, frameWidth: number): Rect {
  return {
    x: Math.max(0, visual.x - 4),
    y: Math.max(0, visual.y + 2),
    width: Math.min(frameWidth, visual.width + 8),
    height: Math.min(FRAME_HEIGHT, visual.height)
  };
}
