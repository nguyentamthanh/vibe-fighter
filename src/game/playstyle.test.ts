import { describe, expect, it } from 'vitest';

import { buildDefaultFighterCombat, buildDefaultFighterStats, DEFAULT_FIGHTER_COMBAT, DEFAULT_FIGHTER_STATS } from './fighterConfig';
import { computeFighterRatings, FIGHTER_PLAYSTYLES } from './playstyle';
import { SELECTABLE_ROSTER } from './roster';

describe('computeFighterRatings', () => {
  it('rates the default tuning as an even 3 everywhere', () => {
    expect(computeFighterRatings(DEFAULT_FIGHTER_STATS, { ...DEFAULT_FIGHTER_COMBAT, specialDamage: 7 })).toEqual({
      power: 3,
      defense: 3,
      speed: 3,
      special: 3
    });
  });

  it('gives every selectable fighter a play style and a distinct rating profile', () => {
    const stats = buildDefaultFighterStats();
    const combat = buildDefaultFighterCombat();
    const profiles = SELECTABLE_ROSTER.map((character) => {
      expect(FIGHTER_PLAYSTYLES[character.id], character.id).toBeDefined();
      const ratings = computeFighterRatings(
        stats[character.id],
        combat[character.id],
        FIGHTER_PLAYSTYLES[character.id]?.specialHits
      );
      return `${ratings.power}${ratings.defense}${ratings.speed}${ratings.special}`;
    });

    expect(new Set(profiles).size).toBe(profiles.length);
  });
});
