# Lore bible — "The Black Dragon Tournament"

Canonical story for Vibe Fighter. The in-game text (`src/game/lore.ts`) is a short copy of the **Origin / Style /
Bio** fields below; change this file first, then sync `lore.ts`. Audience is international, so in-game text is
English; Vietnamese names keep their diacritics only in docs unless the game font is verified.

## Premise
Every year, on the one night the city's rooftops burn orange at dusk, an invitation folded into a black paper
dragon reaches the world's most dangerous fighters. It comes from **Hắc Long — the Black Dragon**, an exiled
kung-fu master who rules the city's underground fight clubs. The tournament is fought on the rooftops (Rooftop
Twilight, Rooftop Sunset). The prize is the **Dragon Seal**: whoever wins takes Hắc Long's empire — or dies trying,
because the final round is against Hắc Long himself.

Every fighter has a personal reason to climb to the last rooftop. Three threads tie the cast together:
- **The stolen relics:** Hắc Long built his power on treasures taken from temples and schools (the Shaolin bronze
  bell technique, the Wudang sword manual).
- **The debt:** his syndicate owns gyms and stadium contracts across the world (Muay Thai, Green Boxer, Red Brawler).
- **The missing:** fighters who entered past tournaments never came home (Jiu-Jitsu Fighter's master).

## Tone
Arcade, larger than life, a little mythic (dragons, ki, legends) but grounded in real martial arts. No gore.
Rivalries are respectful; Hắc Long is the only true villain, and even he follows the tournament's rules.

## Fighters
Fields: **Name** (in-world name) • **Origin** • **Style** • **Bio** (≤ 110 characters, shown in game) •
**Win quote** (≤ 55 characters, shown on the results screen when this fighter wins) • Motive •
Rival • Signature.

### Red Brawler (`red-brawler`)
- **Name:** Kai Rhodes • **Origin:** USA • **Style:** Street fighting
- **Bio:** A street brawler whose neighbourhood gym was bought by the syndicate. He came to take it back.
- **Win quote:** That one's for the neighbourhood. Who's next?
- Motive: win the Dragon Seal and return the gym to his old coach. Rival: Green Boxer (two strikers, two codes).
- Signature: a flurry special that ends in a big haymaker.

### Jiu-Jitsu Fighter (`jiujitsu-fighter`)
- **Name:** Rafael "Tatu" Souza • **Origin:** Brazil • **Style:** Brazilian jiu-jitsu
- **Bio:** His master entered this tournament ten years ago and never came home. Tatu wants answers.
- **Win quote:** Next time, tap out. It hurts less.
- Motive: find out what Hắc Long did to his master. Rival: Viking Berserker (technique vs raw power).

### Green Boxer (`green-boxer`)
- **Name:** Danny Callan • **Origin:** Ireland • **Style:** Boxing
- **Bio:** A banned pro boxer fighting for one last purse to save his family's boxing club.
- **Win quote:** Keep your guard up, pal. That lesson was free.
- Motive: prize money and redemption. Rival: Red Brawler.

### Viking Berserker (`viking-berserker`)
- **Name:** Bjorn Halvard • **Origin:** Norway • **Style:** Berserker axe-fighting
- **Bio:** A warrior from the northern fjords seeking a battle worth a saga. He fights laughing.
- **Win quote:** HA! A fight worth a song! Get up, let's go again!
- Motive: glory; he wants to face the strongest opponent alive. Rival: Jiu-Jitsu Fighter.

### Kunoichi (`kunoichi`)
- **Name:** Aya Kagerō • **Origin:** Japan • **Style:** Ninjutsu
- **Bio:** A shadow agent sent by her clan to steal the Dragon Seal before anyone can win it.
- **Win quote:** You never saw me. Remember that.
- Motive: a mission, not a title; she distrusts everyone. Rival: Monkey King (both want to steal the prize).

### Muay Thai (`muay-thai`)
- **Name:** Krit Sombat • **Origin:** Thailand • **Style:** Muay Thai
- **Bio:** A stadium champion who owes the syndicate his contract. Winning is the only way out.
- **Win quote:** Eight limbs. You only watched two.
- Motive: buy back his freedom. Rival: Shaolin Monk (respectful clash of traditions).

### Shaolin Monk (`shaolin-monk`)
- **Name:** Brother Huiming • **Origin:** China (Songshan) • **Style:** Shaolin kung fu, Golden Bell qigong
- **Bio:** Sent by his temple to bring home a stolen relic. His Golden Bell turns every block into a wall.
- **Win quote:** Anger is a heavy fist. Put it down, friend.
- Motive: recover the temple's relic held by Hắc Long. Rival: Hắc Long, a former guest of the temple who betrayed it.
- Signature: Burning Palm (three fire-palm strikes); guard = **Golden Bell** (Kim Chung Tráo) effect in game.

### Hắc Long (`hac-long`) — host and final boss
- **Name:** Hắc Long, "the Black Dragon" • **Origin:** Unknown (raised in the mountains of the South) •
  **Style:** Black Dragon fist
- **Bio:** Master of the underground and host of the tournament. Nobody has ever taken the Dragon Seal from him.
- **Win quote:** The Dragon Seal stays with me. As it always has.
- Motive: find a successor strong enough to defeat him — or crush every challenger and absorb their schools'
  secrets. He once trained at Shaolin and stole their relic, and he defeated Bai Yun's master on Wudang.
- Look: long black hair in a high topknot, black kung-fu jacket with a gold dragon, red sash; black smoke + gold.
- Signature special: **Kháng Long Hữu Hối** ("the arrogant dragon repents", from the I Ching): a three-strike
  dragon-fist rush ending in a black-smoke dragon head with gold eyes.

### Wudang Swordswoman (`wudang-swordswoman`)
- **Name:** Bai Yun ("White Cloud") • **Origin:** China (Wudang Mountains) • **Style:** Wudang tai chi sword
- **Bio:** A Wudang disciple whose master fell to Hắc Long. Her sword is as soft as cloud and as sharp as lightning.
- **Win quote:** Soft as cloud. You should have listened.
- Motive: avenge her master and recover the stolen Wudang sword manual. Rival: Hắc Long; respects the Monk.
- Look: white-and-pale-blue Taoist robe with flowing sleeves, hair in a bun with a jade pin, straight jian sword
  with a blue tassel. Effects: white wind ribbons and pale blue light (no purple).
- Signature special: "Cloud Hand Sword" — three flowing sword slashes ending in a spiral of white wind.

### Monkey King (`monkey-king`)
- **Name:** Wukong • **Origin:** Mountain of Flowers and Fruit (claims) • **Style:** Monkey kung fu, staff
- **Bio:** A cocky staff master who swears he is the Monkey King reborn. He entered to steal the prize for fun.
- **Win quote:** Too slow! Even my staff got bored.
- Motive: the thrill — and the Dragon Seal would look good on his shelf. Rival: Kunoichi.
- Look: golden-tan fur trim, a gold circlet on the head, red-and-gold armour vest, tiger-skin kilt, the
  gold-banded staff. Inspired by the public-domain *Journey to the West*. Effects: gold dust and cloud puffs.
- Signature special: "Thousand Staff Storm" — a spinning staff barrage ending in a huge staff slam with a gold shockwave.

### Asura Blade (`asura-blade`) — A Tu La Vương, Cuồng Đao
- **Name:** A Tu La Vương ("the Asura King"; in game "A Tu La Vuong") • **Origin:** The realm of endless war •
  **Style:** Mad blade (twin sabers)
- **Bio:** A young asura who walked out of the realm of endless war. His twin sabers hunger for the strongest.
- **Win quote:** My blades are still hungry. Who's next?
- Motive: no relic and no debt. He heard that the Black Dragon is the strongest fighter alive and came to cut him
  down. Rivals: Hắc Long (the prey he wants) and the Viking Berserker (another fighter who loves war).
- Look: an original design inspired by the "mad asura king" archetype (e.g. La Hầu in *Tây Hành Kỷ*), not a copy:
  very long wild silver-white hair, ash-grey skin, crimson demon tattoos, red eyes, a crimson layered battle
  skirt with a rope belt, bare feet. Two identical black demonic sabers with red vein lines and demon-skull guards.
- Signature special: **Asura Twin Crescent**. Two slashes throw two purple blade-qi crescents that fly across
  the stage. The purple is drawn by the engine (`bladeQi.ts`): purple can never be in a sprite, because the
  sprites are keyed on magenta.

## Changing the lore
Add new fighters here first (with a thread to the premise), then copy Origin / Style / Bio to `src/game/lore.ts`,
then add a `changelog.md` line. Keep bios ≤ 110 characters so they fit one line on the select screen.
