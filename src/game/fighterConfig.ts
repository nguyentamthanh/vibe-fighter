import { FIGHTER_CHARACTER_DEFINITIONS, getCharacterDefinition } from './hero';
import { RED_BRAWLER_CHARACTER_ID } from './redBrawler';
import { GREEN_BOXER_CHARACTER_ID } from './greenBoxer';
import { JIUJITSU_FIGHTER_CHARACTER_ID } from './jiujitsuFighter';
import { VIKING_BERSERKER_CHARACTER_ID } from './vikingBerserker';
import { KUNOICHI_CHARACTER_ID } from './kunoichi';
import { MUAY_THAI_CHARACTER_ID } from './muayThai';
import { SHAOLIN_MONK_CHARACTER_ID } from './shaolinMonk';
import { HAC_LONG_CHARACTER_ID } from './hacLong';
import { WUDANG_SWORDSWOMAN_CHARACTER_ID } from './wudangSwordswoman';
import { MONKEY_KING_CHARACTER_ID } from './monkeyKing';
import { ASURA_BLADE_CHARACTER_ID } from './asuraBlade';
import type {
  AttackKind,
  AttackProfile,
  FighterBoundsVisibility,
  FighterCombat,
  FighterPlaygroundDebugState,
  FighterStats
} from './types';

export const FIGHTER_PLAYGROUND_CONFIG_FILE = '/configs/fighter-playground.json';
export const FIGHTER_PLAYGROUND_CONFIG_SAVE_TARGET = 'configs/fighter-playground.json';

/**
 * Baseline movement/physics stats applied to any fighter without a bespoke
 * override. These mirror the playground's original tuning constants.
 */
export const DEFAULT_FIGHTER_STATS: FighterStats = {
  walkSpeed: 230,
  airDrift: 190,
  jump: 980,
  gravity: 2300,
  scale: 1.4
};

/**
 * Per-character starting balance. Tunable in the playground debug panel and
 * persisted to `public/configs/fighter-playground.json`.
 */
const FIGHTER_STAT_OVERRIDES: Record<string, Partial<FighterStats>> = {
  [RED_BRAWLER_CHARACTER_ID]: {},
  [GREEN_BOXER_CHARACTER_ID]: { walkSpeed: 250, jump: 1000 },
  [JIUJITSU_FIGHTER_CHARACTER_ID]: { walkSpeed: 240, airDrift: 210, jump: 1040 },
  // Heavy and slow: walks and jumps less than the others.
  [VIKING_BERSERKER_CHARACTER_ID]: { walkSpeed: 200, airDrift: 170, jump: 920 },
  // Light and fast: quickest walk and highest jump.
  [KUNOICHI_CHARACTER_ID]: { walkSpeed: 270, airDrift: 230, jump: 1080 },
  // Pressure fighter: steps in quickly, short reach.
  [MUAY_THAI_CHARACTER_ID]: { walkSpeed: 250, jump: 1000 },
  // Agile: high, floaty jump.
  [SHAOLIN_MONK_CHARACTER_ID]: { airDrift: 210, jump: 1060 },
  // The tournament host: steady pace.
  [HAC_LONG_CHARACTER_ID]: { walkSpeed: 240 },
  // Light on her feet: quick steps and a slightly floaty jump.
  [WUDANG_SWORDSWOMAN_CHARACTER_ID]: { walkSpeed: 240, airDrift: 210, jump: 1020 },
  // Acrobat: quick feet and the highest jump in the roster.
  [MONKEY_KING_CHARACTER_ID]: { walkSpeed: 245, airDrift: 220, jump: 1100 },
  // Reckless: rushes in fast.
  [ASURA_BLADE_CHARACTER_ID]: { walkSpeed: 255, airDrift: 220, jump: 1040 }
};

/**
 * Editable stat field metadata used to render the debug panel inputs and to
 * clamp values to sane ranges.
 */
export interface FighterStatField {
  id: keyof FighterStats;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const FIGHTER_STAT_FIELDS: FighterStatField[] = [
  { id: 'walkSpeed', label: 'Walk speed', min: 40, max: 600, step: 5 },
  { id: 'airDrift', label: 'Air drift', min: 0, max: 600, step: 5 },
  { id: 'jump', label: 'Jump power', min: 200, max: 2000, step: 10 },
  { id: 'gravity', label: 'Gravity', min: 400, max: 5000, step: 25 },
  { id: 'scale', label: 'Scale', min: 0.5, max: 3, step: 0.05 }
];

/**
 * Baseline combat tuning applied to any fighter without a bespoke override.
 * The light attack ("high") is fast and light; the heavy attack ("low") hits
 * harder, pushes further, and stuns longer.
 */
export const DEFAULT_FIGHTER_COMBAT: FighterCombat = {
  maxHealth: 100,
  highDamage: 7,
  highKnockback: 180,
  highHitstun: 280,
  lowDamage: 12,
  lowKnockback: 340,
  lowHitstun: 440,
  specialDamage: 6,
  specialKnockback: 150,
  specialHitstun: 240,
  defense: 0,
  guardBreak: 0,
  meterGain: 100
};

/**
 * Per-character combat balance: each fighter leans on a different strength so the
 * picks play differently (archetypes and ratings in `playstyle.ts`). Tunable in the
 * playground debug panel and persisted alongside the movement stats.
 */
const FIGHTER_COMBAT_OVERRIDES: Record<string, Partial<FighterCombat>> = {
  // All-rounder: the baseline every other fighter is measured against.
  [RED_BRAWLER_CHARACTER_ID]: { specialDamage: 7, specialKnockback: 170 },
  // Rushdown: hard, fast jabs that stun long enough to chain, and quick meter from combos.
  [GREEN_BOXER_CHARACTER_ID]: {
    defense: 5,
    highDamage: 10,
    highKnockback: 220,
    highHitstun: 320,
    lowDamage: 10,
    lowKnockback: 300,
    meterGain: 130
  },
  // Grappler: sturdy, weak jab but a crushing sweep with long stun; weak special.
  [JIUJITSU_FIGHTER_CHARACTER_ID]: {
    maxHealth: 110,
    defense: 10,
    highDamage: 6,
    lowDamage: 14,
    lowKnockback: 380,
    lowHitstun: 520,
    specialDamage: 5,
    specialHitstun: 220,
    meterGain: 110
  },
  // Juggernaut: the most health and armour, axe blows chip through guards; slow meter.
  [VIKING_BERSERKER_CHARACTER_ID]: {
    maxHealth: 120,
    defense: 15,
    highDamage: 8,
    lowDamage: 15,
    lowKnockback: 400,
    specialDamage: 8,
    specialKnockback: 190,
    guardBreak: 25,
    meterGain: 80
  },
  // Speedster: fragile with light hits, but the fastest meter and a strong special.
  [KUNOICHI_CHARACTER_ID]: {
    maxHealth: 85,
    highDamage: 6,
    highHitstun: 300,
    lowDamage: 10,
    specialDamage: 9,
    meterGain: 125
  },
  // Pressure: the hardest normal hits in the roster, and they wear guards down.
  [MUAY_THAI_CHARACTER_ID]: {
    highDamage: 8,
    lowDamage: 14,
    lowKnockback: 360,
    specialDamage: 8,
    guardBreak: 20
  },
  // Iron wall: light hits, but takes the least damage (and the Golden Bell blocks all chip).
  [SHAOLIN_MONK_CHARACTER_ID]: {
    defense: 20,
    lowDamage: 11,
    specialDamage: 8,
    specialKnockback: 180
  },
  // Final boss: strong at everything, the heaviest special finisher in the game.
  [HAC_LONG_CHARACTER_ID]: {
    maxHealth: 110,
    defense: 10,
    highDamage: 8,
    lowDamage: 13,
    specialDamage: 10,
    specialKnockback: 220,
    guardBreak: 15,
    meterGain: 90
  },
  // Duelist: sharp sword hits that nick through guards, but fragile.
  [WUDANG_SWORDSWOMAN_CHARACTER_ID]: {
    maxHealth: 90,
    highDamage: 9,
    lowDamage: 11,
    specialDamage: 8,
    guardBreak: 10,
    meterGain: 115
  },
  // Trickster: weak pokes, but the meter fills fastest of all for frequent specials.
  [MONKEY_KING_CHARACTER_ID]: {
    maxHealth: 95,
    defense: 5,
    highDamage: 6,
    lowDamage: 11,
    specialDamage: 8,
    meterGain: 150
  },
  // Berserker: the biggest blade hits in the game and two flying blade-qi crescents (13 each),
  // but the lowest health and no armour.
  [ASURA_BLADE_CHARACTER_ID]: {
    maxHealth: 85,
    highDamage: 9,
    lowDamage: 15,
    lowKnockback: 380,
    specialDamage: 13,
    specialKnockback: 220,
    guardBreak: 10
  }
};

/**
 * Editable combat field metadata used to render the debug panel inputs and to
 * clamp values to sane ranges.
 */
export interface FighterCombatField {
  id: keyof FighterCombat;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const FIGHTER_COMBAT_FIELDS: FighterCombatField[] = [
  { id: 'maxHealth', label: 'Max HP', min: 50, max: 300, step: 5 },
  { id: 'highDamage', label: 'High dmg', min: 1, max: 50, step: 1 },
  { id: 'highKnockback', label: 'High kb', min: 0, max: 800, step: 10 },
  { id: 'highHitstun', label: 'High stun', min: 0, max: 1200, step: 20 },
  { id: 'lowDamage', label: 'Low dmg', min: 1, max: 50, step: 1 },
  { id: 'lowKnockback', label: 'Low kb', min: 0, max: 800, step: 10 },
  { id: 'lowHitstun', label: 'Low stun', min: 0, max: 1200, step: 20 },
  { id: 'specialDamage', label: 'Special dmg', min: 1, max: 50, step: 1 },
  { id: 'specialKnockback', label: 'Special kb', min: 0, max: 800, step: 10 },
  { id: 'specialHitstun', label: 'Special stun', min: 0, max: 1200, step: 20 },
  { id: 'defense', label: 'Defense %', min: 0, max: 60, step: 1 },
  { id: 'guardBreak', label: 'Chip %', min: 0, max: 100, step: 1 },
  { id: 'meterGain', label: 'Meter gain %', min: 25, max: 300, step: 5 }
];

/**
 * Debug bounds overlay metadata, shared by the playground panel (colour
 * swatches) and the scene renderer (stroke/fill colours).
 */
export interface FighterBoundsField {
  id: keyof FighterBoundsVisibility;
  label: string;
  color: string;
}

export const FIGHTER_BOUNDS_FIELDS: FighterBoundsField[] = [
  { id: 'visual', label: 'Visual', color: '#38bdf8' },
  { id: 'collision', label: 'Collision', color: '#facc15' },
  { id: 'hit', label: 'Hit', color: '#22c55e' },
  { id: 'attack', label: 'Attack', color: '#f43f5e' },
  { id: 'guard', label: 'Guard', color: '#a855f7' }
];

export interface FighterPlaygroundConfigExport {
  version: number;
  savedAt: string;
  characterId: string;
  reverseWalk: boolean;
  stats: Record<string, FighterStats>;
  combat: Record<string, FighterCombat>;
}

/**
 * Build the default per-character stats map for every selectable fighter.
 */
export function buildDefaultFighterStats(): Record<string, FighterStats> {
  const stats: Record<string, FighterStats> = {};

  FIGHTER_CHARACTER_DEFINITIONS.forEach((character) => {
    stats[character.id] = clampFighterStats({
      ...DEFAULT_FIGHTER_STATS,
      ...FIGHTER_STAT_OVERRIDES[character.id]
    });
  });

  return stats;
}

/**
 * Build the default per-character combat map for every selectable fighter.
 */
export function buildDefaultFighterCombat(): Record<string, FighterCombat> {
  const combat: Record<string, FighterCombat> = {};

  FIGHTER_CHARACTER_DEFINITIONS.forEach((character) => {
    combat[character.id] = clampFighterCombat({
      ...DEFAULT_FIGHTER_COMBAT,
      ...FIGHTER_COMBAT_OVERRIDES[character.id]
    });
  });

  return combat;
}

/**
 * Build the default Fighter Playground debug state (default selection + stats).
 */
export function createDefaultFighterPlaygroundState(): FighterPlaygroundDebugState {
  return {
    characterId: defaultFighterCharacterId(),
    stats: buildDefaultFighterStats(),
    combat: buildDefaultFighterCombat(),
    bounds: { visual: false, collision: false, hit: false, attack: false, guard: false },
    reverseWalk: false,
    fillSpecial: false,
    saveStatus: 'Loaded from public/configs/fighter-playground.json'
  };
}

/**
 * Resolve the stats for a character, falling back to defaults when absent.
 * @param state - The current playground debug state.
 * @param characterId - The character to resolve stats for.
 */
export function getFighterStats(
  state: FighterPlaygroundDebugState,
  characterId: string
): FighterStats {
  return state.stats[characterId] ?? clampFighterStats(DEFAULT_FIGHTER_STATS);
}

/**
 * Resolve the combat tuning for a character, falling back to defaults.
 * @param state - The current playground debug state.
 * @param characterId - The character to resolve combat for.
 */
export function getFighterCombat(
  state: FighterPlaygroundDebugState,
  characterId: string
): FighterCombat {
  return state.combat?.[characterId] ?? clampFighterCombat(DEFAULT_FIGHTER_COMBAT);
}

/**
 * Resolve a single attack's profile (damage/knockback/hitstun + guard height)
 * for the given attack button.
 * @param combat - The character's combat tuning.
 * @param kind - Which attack: `high` (light) or `low` (heavy).
 */
export function getAttackProfile(combat: FighterCombat, kind: AttackKind): AttackProfile {
  if (kind === 'high') {
    return {
      kind: 'high',
      height: 'high',
      damage: combat.highDamage,
      knockback: combat.highKnockback,
      hitstun: combat.highHitstun,
      guardBreak: combat.guardBreak
    };
  }

  if (kind === 'special') {
    return {
      kind: 'special',
      height: 'high',
      damage: combat.specialDamage,
      knockback: combat.specialKnockback,
      hitstun: combat.specialHitstun,
      guardBreak: combat.guardBreak
    };
  }

  return {
    kind: 'low',
    height: 'low',
    damage: combat.lowDamage,
    knockback: combat.lowKnockback,
    hitstun: combat.lowHitstun,
    guardBreak: combat.guardBreak
  };
}

/**
 * Serialize the playground stats for persistence.
 * @param state - The current playground debug state.
 */
export function buildFighterPlaygroundConfigExport(
  state: FighterPlaygroundDebugState
): FighterPlaygroundConfigExport {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    characterId: normalizeFighterCharacterId(state.characterId),
    reverseWalk: Boolean(state.reverseWalk),
    stats: normalizeFighterStatsMap(state.stats),
    combat: normalizeFighterCombatMap(state.combat)
  };
}

/**
 * Fetch the persisted playground config, returning null when unavailable.
 */
export async function loadFighterPlaygroundConfig(): Promise<Partial<FighterPlaygroundConfigExport> | null> {
  try {
    const response = await fetch(FIGHTER_PLAYGROUND_CONFIG_FILE, { cache: 'no-store' });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as Partial<FighterPlaygroundConfigExport>;
  } catch {
    return null;
  }
}

/**
 * Merge a persisted config into the current playground state, keeping defaults
 * for any missing characters or fields.
 * @param current - The current playground debug state.
 * @param saved - The persisted config (may be partial or null).
 */
export function mergeFighterPlaygroundState(
  current: FighterPlaygroundDebugState,
  saved: Partial<FighterPlaygroundConfigExport> | null
): FighterPlaygroundDebugState {
  if (!saved) {
    return current;
  }

  const mergedStats: Record<string, FighterStats> = { ...current.stats };

  if (saved.stats && typeof saved.stats === 'object') {
    FIGHTER_CHARACTER_DEFINITIONS.forEach((character) => {
      const savedStats = saved.stats?.[character.id];

      if (savedStats) {
        mergedStats[character.id] = clampFighterStats({
          ...mergedStats[character.id],
          ...savedStats
        });
      }
    });
  }

  const mergedCombat: Record<string, FighterCombat> = { ...current.combat };

  if (saved.combat && typeof saved.combat === 'object') {
    FIGHTER_CHARACTER_DEFINITIONS.forEach((character) => {
      const savedCombat = saved.combat?.[character.id];

      if (savedCombat) {
        mergedCombat[character.id] = clampFighterCombat({
          ...mergedCombat[character.id],
          ...savedCombat
        });
      }
    });
  }

  return {
    ...current,
    characterId: normalizeFighterCharacterId(saved.characterId ?? current.characterId),
    reverseWalk: typeof saved.reverseWalk === 'boolean' ? saved.reverseWalk : current.reverseWalk,
    stats: mergedStats,
    combat: mergedCombat
  };
}

/**
 * Clamp a stats object to the configured field ranges, filling missing fields.
 * @param value - Partial stats to clamp.
 */
export function clampFighterStats(value: Partial<FighterStats>): FighterStats {
  const result = {} as FighterStats;

  FIGHTER_STAT_FIELDS.forEach((field) => {
    result[field.id] = clamp(value[field.id], field.min, field.max, DEFAULT_FIGHTER_STATS[field.id]);
  });

  return result;
}

/**
 * Clamp a combat object to the configured field ranges, filling missing fields.
 * @param value - Partial combat tuning to clamp.
 */
export function clampFighterCombat(value: Partial<FighterCombat>): FighterCombat {
  const result = {} as FighterCombat;

  FIGHTER_COMBAT_FIELDS.forEach((field) => {
    result[field.id] = clamp(value[field.id], field.min, field.max, DEFAULT_FIGHTER_COMBAT[field.id]);
  });

  return result;
}

/**
 * Default selectable fighter (first fighter in the roster, preferring the red brawler).
 */
export function defaultFighterCharacterId(): string {
  const preferred = FIGHTER_CHARACTER_DEFINITIONS.find(
    (character) => character.id === RED_BRAWLER_CHARACTER_ID
  );

  return preferred?.id ?? FIGHTER_CHARACTER_DEFINITIONS[0]?.id ?? RED_BRAWLER_CHARACTER_ID;
}

function normalizeFighterCharacterId(value: unknown): string {
  if (typeof value === 'string' && FIGHTER_CHARACTER_DEFINITIONS.some((character) => character.id === value)) {
    return getCharacterDefinition(value).id;
  }

  return defaultFighterCharacterId();
}

function normalizeFighterStatsMap(value: unknown): Record<string, FighterStats> {
  const stats: Record<string, FighterStats> = {};

  FIGHTER_CHARACTER_DEFINITIONS.forEach((character) => {
    const candidate = (value as Record<string, Partial<FighterStats>> | undefined)?.[character.id];
    stats[character.id] = clampFighterStats({
      ...DEFAULT_FIGHTER_STATS,
      ...FIGHTER_STAT_OVERRIDES[character.id],
      ...candidate
    });
  });

  return stats;
}

function normalizeFighterCombatMap(value: unknown): Record<string, FighterCombat> {
  const combat: Record<string, FighterCombat> = {};

  FIGHTER_CHARACTER_DEFINITIONS.forEach((character) => {
    const candidate = (value as Record<string, Partial<FighterCombat>> | undefined)?.[character.id];
    combat[character.id] = clampFighterCombat({
      ...DEFAULT_FIGHTER_COMBAT,
      ...FIGHTER_COMBAT_OVERRIDES[character.id],
      ...candidate
    });
  });

  return combat;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
