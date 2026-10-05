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
  'hac-long'
];

export const SELECTABLE_ROSTER: CharacterDefinition[] = FIGHTER_CHARACTER_DEFINITIONS.filter((character) =>
  SELECTABLE_FIGHTER_IDS.includes(character.id)
);
