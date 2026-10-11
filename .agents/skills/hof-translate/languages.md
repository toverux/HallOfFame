# What each locale does differently

The conventions a translator or a reviewer of a locale needs and would not guess from the English.
Shared by all: the file's existing form of address and its words for the mod's own concepts (creator, playset, asset, mod, screenshot) win over the game's; the game's word wins for anything the game itself names; a string that extends one of Skyve's verdict labels starts from that label in `HallOfFame/Locales/Skyve/<locale>.json`; a weather or climate value takes the national forecast vocabulary; a column header or a chip label stays as short as the English; a label a player ticks for themselves stays in the first person where the English is.

## de-DE

- Du. Die Mod is feminine, so every label agreeing with a row agrees feminine.
- The game hyphenates "Paradox-Mods"; the file writes "Paradox Mods".
- A setting name in prose is bare, no quotes, capitalized as the game writes it.

## es-ES

- Tú. The game's name for an option is treated as a singular noun of the option's gender when a sentence predicates it ("la opción ... estaba desactivada").
- The file writes "Paradox Mods" where the game says "Mods de Paradox".
- A review happens "en la versión" of the game, not "para".

## fr-FR

- Vous in sentences; first person on the player's own toggles.
- U+00A0, the ordinary no-break space, before : ; ? ! and inside « »; a product name keeps its English punctuation ("Cities: Skylines II").
- "map" is a Paradox Mods map asset, "carte" the city's map; "asset" and "playset" stay English.
- A setting name in prose is bare and capitalized; "sous une autre latitude".
- The file writes "Paradox Mods" where the game says "Mods Paradox".

## it-IT

- Tu. Mod is feminine in the file's newer strings; a label agreeing with a row agrees feminine.
- The game's menu translates Mods as "Modalità", a mistranslation: write "mod".
- A bare adjective as a label ("Tue") reads oddly; give it its article ("Le tue").

## ja-JP

- The file writes MOD in capitals.
- The game's own names are followed even where odd (Temperature is 色気温).
- Full-width colon after a Latin name ("Skyve："); a relative date needs its particle after the placeholder ("{WHEN}に"); the hemisphere word comes before the angle (北緯 {ANGLE}°).
- サブスク is a subscription service, not a count of subscribers.
- A one-word heading that is vague alone takes a qualifier (撮影条件 rather than 条件).

## ko-KR

- 게시자 for creator, 사용자님 for "you".
- The game writes 에셋; older mod strings wrote 애셋, and new strings follow the game.
- The hemisphere word comes before the angle (북위 {ANGLE}°); a relative date takes 에 after the placeholder; a version is a basis ("기준으로").
- The forecast scale has five steps: 맑음, 대체로 맑음, 구름 조금, 구름 많음, 흐림.

## nl-NL

- Je. Auteur for creator; compounds are written closed (Codemods, Assetpacks).
- The game ships no Dutch: a game setting named in prose keeps its English name in parentheses once, so the player finds it in the game's own panel.
- Passive perfect with "is", never "was"; an action label is an infinitive ("Tonen").
- A relative date takes no "op" before the placeholder.

## pl-PL

- Ty with capitalized Twój; the viewer is addressed in the masculine past tense.
- No noun is declined after a number placeholder: build the sentence so the number ends a clause ("...: {OWNED} z {TOTAL}").
- The game's word for assets is Zasoby; the mod's showcased asset is "obiekt".
- „ ” quotes; a setting name in prose is capitalized when it names the control.

## pt-BR

- The game's own setting names are followed even where odd ("Tingir" for Tint, "Balanceamento com o branco"), with no article before a setting name in prose.
- The game's word for assets is Elementos; the mod's showcased asset is "recurso".
- "modo foto" lowercase in prose.

## pt-PT

- Tu. European usage throughout: criador, conjunto for playset, recurso, captura de ecrã, partilhar.
- The game ships only pt-BR: a setting named in prose keeps the game's Brazilian name, so the player finds it; a category chip takes the European word.
- "Avaliar" for reviewing: "revisor" is a proofreader.
- A bare possessive as a label takes its article ("Os teus"); a label agreeing with several masculine items agrees masculine ("Todos").

## ru-RU

- Вы. Набор for playset, ассет; «» quotes; no dashes even where Russian would put one.
- The game says Объекты for both assets and props: props take a distinct word (Пропсы).
- No noun is declined after a number placeholder: build the sentence so the number ends a clause ("...: {OWNED} из {TOTAL}").
- Hemispheres as с. ш. / ю. ш.; a Skyve label in the neuter.

## zh-HANS

- The proofreader's terms win over the game's: 照相模式 (the game says 照片模式), 配组 for playset where older strings still say "playset", 模组, 您, 城市画廊 for Hall of Fame.
- 度 is the degree sign, after the placeholder (北纬{ANGLE}度); the hemisphere word comes first.
- Spaces around Latin words and numbers; a half-width colon after a Latin name as the proofreader writes it.

## zh-HANT

- Taiwan usage. Playset stays in Latin letters; 創作者, 模組, 資產, 螢幕截圖, 照相模式.
- The game's own setting names are followed even where odd (暈色 for Tint, 一日中的時間 for Time of Day).
- The hemisphere word comes before the angle (北緯 {ANGLE}°); a label before a placeholder that may start with a digit or a word takes a full-width colon ("審核時間：{WHEN}") so the spacing holds either way.
- A two-character noun that also reads as a verb takes a qualifier as a column header (訂閱數, 更新時間).
