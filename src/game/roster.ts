import { FIGHTER_CHARACTER_DEFINITIONS, type CharacterDefinition } from './hero';

/** Fighters offered on the character select screen, in display order (ids without a definition are skipped). */
const SELECTABLE_FIGHTER_IDS = [
  'red-brawler',
  'jiujitsu-fighter',
  'green-boxer',
  'viking-berserker',
  'kunoichi',
  'muay-thai',
  'shaolin-monk',
  'wudang-swordswoman',
  'monkey-king',
  'asura-blade',
  'hac-long'
];

export const SELECTABLE_ROSTER: CharacterDefinition[] = SELECTABLE_FIGHTER_IDS.flatMap((id) =>
  FIGHTER_CHARACTER_DEFINITIONS.filter((character) => character.id === id)
);
