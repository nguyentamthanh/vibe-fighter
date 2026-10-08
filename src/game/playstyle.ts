import type { FighterCombat, FighterStats } from './types';

/**
 * Each fighter's play style: an archetype name and a one-line tip, shown on the
 * character select screen next to the ratings. The numbers behind it live in
 * `fighterConfig.ts`; the design table is in the skill's `references/roster.md`.
 */
export interface FighterPlaystyle {
  archetype: string;
  tip: string;
  /** Accent colour of the archetype tag (0xRRGGBB). */
  color: number;
  /** Hits in one special (default 3); used by the special rating. */
  specialHits?: number;
}

export const FIGHTER_PLAYSTYLES: Record<string, FighterPlaystyle> = {
  'red-brawler': {
    archetype: 'All-rounder',
    tip: 'No weak spot: a solid pick to learn the game.',
    color: 0xef4444
  },
  'green-boxer': {
    archetype: 'Rushdown',
    tip: 'Fast, heavy jabs that chain and fill the meter quickly.',
    color: 0x22c55e
  },
  'jiujitsu-fighter': {
    archetype: 'Grappler',
    tip: 'Tough. Land the low sweep: it hits hard and stuns long.',
    color: 0x14b8a6
  },
  'viking-berserker': {
    archetype: 'Juggernaut',
    tip: 'Slow but very tough; axe blows chip through any guard.',
    color: 0xf97316
  },
  kunoichi: {
    archetype: 'Speedster',
    tip: 'Fragile and light-handed, but fast with a deadly special.',
    color: 0xa855f7
  },
  'muay-thai': {
    archetype: 'Pressure',
    tip: 'The hardest normal hits; keep attacking even into a block.',
    color: 0xeab308
  },
  'shaolin-monk': {
    archetype: 'Iron Wall',
    tip: 'Takes the least damage; the Golden Bell stops all chip.',
    color: 0xf59e0b
  },
  'hac-long': {
    archetype: 'Boss',
    tip: 'Strong everywhere, with the heaviest special finisher.',
    color: 0x64748b
  },
  'wudang-swordswoman': {
    archetype: 'Duelist',
    tip: 'Sharp sword hits and a strong special, but fragile.',
    color: 0x38bdf8
  },
  'monkey-king': {
    archetype: 'Trickster',
    tip: 'Weak pokes, but the fastest meter: special after special.',
    color: 0xfacc15
  },
  'asura-blade': {
    archetype: 'Berserker',
    tip: 'Huge damage and blade-qi from range, but almost no defense.',
    color: 0x9333ea,
    specialHits: 2
  }
};

export interface FighterRatings {
  power: number;
  defense: number;
  speed: number;
  special: number;
}

export const RATING_MAX = 5;

/**
 * 1–5 ratings derived from the live tuning, so the select screen never drifts
 * from the real numbers. Each rating is centred on the default fighter (3):
 * - power: light + heavy damage;
 * - defense: effective health (max health after the defense reduction);
 * - speed: walk speed;
 * - special: whole-special damage (`specialHits` hits, 3 by default) times the meter gain rate.
 * @param stats - The fighter's movement stats.
 * @param combat - The fighter's combat tuning.
 * @param specialHits - Hits in one special.
 */
export function computeFighterRatings(stats: FighterStats, combat: FighterCombat, specialHits = 3): FighterRatings {
  const effectiveHealth = combat.maxHealth / Math.max(0.1, 1 - combat.defense / 100);
  const specialValue = (combat.specialDamage * specialHits * combat.meterGain) / 100;

  return {
    power: rate(3 + (combat.highDamage + combat.lowDamage - 19) / 1.5),
    defense: rate(3 + (effectiveHealth - 100) / 15),
    speed: rate(3 + (stats.walkSpeed - 235) / 15),
    special: rate(3 + (specialValue - 22) / 5)
  };
}

/**
 * Short trait lines for the numbers a rating bar hides (chip damage, meter rate,
 * damage reduction).
 * @param combat - The fighter's combat tuning.
 */
export function describeFighterTraits(combat: FighterCombat): string[] {
  const traits: string[] = [];

  if (combat.defense > 0) {
    traits.push(`Takes ${combat.defense}% less damage`);
  }
  if (combat.guardBreak > 0) {
    traits.push(`Chips ${combat.guardBreak}% through blocks`);
  }
  if (combat.meterGain !== 100) {
    traits.push(`Meter x${(combat.meterGain / 100).toFixed(2).replace(/0$/, '')}`);
  }

  return traits;
}

/**
 * The play style of a fighter, or null when none is written yet.
 * @param characterId - The fighter id.
 */
export function getFighterPlaystyle(characterId: string): FighterPlaystyle | null {
  return FIGHTER_PLAYSTYLES[characterId] ?? null;
}

function rate(value: number): number {
  return Math.min(RATING_MAX, Math.max(1, Math.round(value)));
}
