/**
 * In-game story text for "The Black Dragon Tournament": each fighter's in-world name, origin, fighting style, a
 * one-line bio (≤ 110 characters) shown on the character select screen, and a victory quote (≤ 55 characters)
 * shown on the results screen.
 *
 * Canonical source: `.claude/skills/vibe-fighter-dev/references/lore.md` — edit the lore there first, then copy the
 * Origin / Style / Bio / Win quote fields here.
 */
export interface FighterLore {
  name: string;
  origin: string;
  style: string;
  bio: string;
  winQuote: string;
}

export const TOURNAMENT_NAME = 'The Black Dragon Tournament';

export const FIGHTER_LORE: Record<string, FighterLore> = {
  'red-brawler': {
    name: 'Kai Rhodes',
    origin: 'USA',
    style: 'Street fighting',
    bio: 'A street brawler whose neighbourhood gym was bought by the syndicate. He came to take it back.',
    winQuote: "That one's for the neighbourhood. Who's next?"
  },
  'jiujitsu-fighter': {
    name: 'Rafael "Tatu" Souza',
    origin: 'Brazil',
    style: 'Brazilian jiu-jitsu',
    bio: 'His master entered this tournament ten years ago and never came home. Tatu wants answers.',
    winQuote: 'Next time, tap out. It hurts less.'
  },
  'green-boxer': {
    name: 'Danny Callan',
    origin: 'Ireland',
    style: 'Boxing',
    bio: "A banned pro boxer fighting for one last purse to save his family's boxing club.",
    winQuote: 'Keep your guard up, pal. That lesson was free.'
  },
  'viking-berserker': {
    name: 'Bjorn Halvard',
    origin: 'Norway',
    style: 'Berserker axe-fighting',
    bio: 'A warrior from the northern fjords seeking a battle worth a saga. He fights laughing.',
    winQuote: "HA! A fight worth a song! Get up, let's go again!"
  },
  kunoichi: {
    name: 'Aya Kagero',
    origin: 'Japan',
    style: 'Ninjutsu',
    bio: 'A shadow agent sent by her clan to steal the Dragon Seal before anyone can win it.',
    winQuote: 'You never saw me. Remember that.'
  },
  'muay-thai': {
    name: 'Krit Sombat',
    origin: 'Thailand',
    style: 'Muay Thai',
    bio: 'A stadium champion who owes the syndicate his contract. Winning is the only way out.',
    winQuote: 'Eight limbs. You only watched two.'
  },
  'shaolin-monk': {
    name: 'Brother Huiming',
    origin: 'China',
    style: 'Shaolin kung fu',
    bio: 'Sent by his temple to bring home a stolen relic. His Golden Bell turns every block into a wall.',
    winQuote: 'Anger is a heavy fist. Put it down, friend.'
  },
  'hac-long': {
    name: 'Hac Long, the Black Dragon',
    origin: 'Unknown',
    style: 'Black Dragon fist',
    bio: 'Master of the underground and host of the tournament. Nobody has ever taken the Dragon Seal from him.',
    winQuote: 'The Dragon Seal stays with me. As it always has.'
  },
  'wudang-swordswoman': {
    name: 'Bai Yun',
    origin: 'China',
    style: 'Wudang tai chi sword',
    bio: 'A Wudang disciple whose master fell to Hac Long. Her sword is soft as cloud, sharp as lightning.',
    winQuote: 'Soft as cloud. You should have listened.'
  },
  'monkey-king': {
    name: 'Wukong',
    origin: 'Mountain of Flowers and Fruit',
    style: 'Monkey kung fu, staff',
    bio: 'A cocky staff master who swears he is the Monkey King reborn. He entered to steal the prize for fun.',
    winQuote: 'Too slow! Even my staff got bored.'
  },
  'asura-blade': {
    name: 'A Tu La Vuong, the Asura King',
    origin: 'The realm of endless war',
    style: 'Mad blade (twin sabers)',
    bio: 'A young asura who walked out of the realm of endless war. His twin sabers hunger for the strongest.',
    winQuote: "My blades are still hungry. Who's next?"
  }
};

/**
 * Story text for a fighter, or null when none is written yet.
 * @param characterId - The fighter id (e.g. `shaolin-monk`).
 */
export function getFighterLore(characterId: string): FighterLore | null {
  return FIGHTER_LORE[characterId] ?? null;
}
