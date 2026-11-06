# What each locale does differently

The conventions a translator or a reviewer of a locale needs and would not guess from the English.

## Every locale

- **Term or practice.** A term is the game's name for an element the player must find in its UI: a menu, a tool, an info view, a setting, a building category. Where a string points the player at one, write the term as the game writes it in that language, odd or wrong: its words and capitals bind, while its quotes, apostrophes and spacing follow the typography below. Everything else is practice: typography, punctuation, grammar, register, capitalization, and every generic word, even one the game also uses. There, write what a professional translator would, never what the game does. Example: it-IT's game names the Mods menu "Modalità"; "mod" in prose is a generic word and stays "mod", while a sentence sending the player to that menu names it "Modalità".
- Each locale below lists its **game errors**, the game's practice not to copy, each with what to write instead, and its **game terms**, odd names used anyway.
- `{…}` is a variable: copy it byte for byte, `{KEY=…}` included, even where it reads as English.
- `<…>` renders as highlighted text: translate the text inside and keep the chevrons. In `<ID|label>` only the label after `|` is text; `<icon:…>`, `<image:…>` and `<inputAction:…>` are copied verbatim.
- Typography is the language's own: its typographic quotes, the apostrophe ’, the ellipsis …, the no-break space U+00A0. Write no straight ' or ", no three dots, and no dash (em dash, en dash, a spaced hyphen): a colon, a comma or parentheses carry the clause instead.
- **Banned**: U+202F and U+2009 → U+00A0. The game (measured on 1.6.2f1) breaks the line at either as at a plain space, orphaning a French : or ».
- The source's punctuation is deliberate: each mark carries over in the language's form. A colon stays a colon, a question a question, a final period a final period, and a label without one gets none.
- Capitalize as the language does: English Title Case becomes the language's sentence case, nouns aside where the language capitalizes them; a game term keeps the game's capitals.
- The file's existing form of address and its words for the mod's own concepts win over the game's; a column header or a button label stays as short as the English; a label a player ticks for themselves stays in the first person where the English is; where nouns decline, none follows a number placeholder: build the sentence so the number ends a clause ("…: {COUNT}").

## en-US (the source)

- Title Case for a label, a group, a section or a button; sentence case for a description.
- Game errors: ' " and ... → ’, “ ” and …; labels in sentence case ("Near max radius") → Title Case.

## de-DE

- „ “ quotes; a setting name in prose is bare, no quotes, capitalized as the game writes it.
- Game errors: du and Sie mixed → the file's du; "..." → …; a compound split by spaces ("Tilt-Shift Nahfeld Beginn") → joined or hyphenated; an English plural ("Dependencys") → the German word (Abhängigkeiten).

## es-ES

- The game's name for an option is treated as a singular noun of the option's gender when a sentence predicates it ("la opción … estaba desactivada").
- A change happens "en la versión" of the game, not "para".
- Game errors: straight "…" quotes → « », “ ” inside them; "..." → …; " - " as a separator → a colon.

## fr-FR

- « » with U+00A0, the ordinary no-break space, inside; U+00A0 before : ; ? !; a product name keeps its English punctuation ("Cities: Skylines II").
- A setting name in prose is bare and capitalized.
- Game errors: ' → ’; "..." → …; a plain space, or none, before : ; ? ! or inside « » → U+00A0; " - " as a separator → a colon.

## it-IT

- A bare adjective as a label ("Tue") reads oddly; give it its article ("Le tue").
- Game errors: straight "…" quotes → « »; ' → ’; "..." → …; " - " as a separator → a colon.
- Game terms: the Mods menu is "Modalità" (see Every locale); Elementi for assets, Oggetti for props.

## ja-JP

- Full-width punctuation: 「」 quotes, ：（）！？; a full-width colon after a Latin name.
- A relative date or a count needs its particle after the placeholder; a one-word heading that is vague alone takes a qualifier.
- Game errors: MOD and Mod mixed → MOD; half-width ( ) : , beside Japanese ("学習(ワークショップ)") → full-width; an ASCII space after a ？ or ！ the sentence goes on from → U+3000, the full-width space; a space between Japanese and Latin letters or digits ("ユニバーサル Mod パネル") → none ("MOD作者").

## ko-KR

- A particle after a placeholder whose last sound is unknown gives both forms: 이(가), 을(를), 은(는), (으)로; a relative date takes 에 after the placeholder.
- Game errors: straight " and ' quotes → “ ” and ‘ ’; "..." → ….
- Game term: 에셋 for assets, not 애셋.

## nl-NL

- Compounds are written closed (Codemods, Assetpacks).
- The game ships no Dutch: a game setting named in prose keeps its English name in parentheses once, so the player finds it in the game's own panel.
- Passive perfect with "is", never "was"; an action label is an infinitive ("Tonen").
- A relative date takes no "op" before the placeholder.

## pl-PL

- „ ” quotes; a setting name in prose is capitalized when it names the control.
- Game errors: "..." → …; a spaced en dash in a description → a colon or a comma.
- Game term: Zasoby for assets.

## pt-BR

- No article before a setting name in prose.
- Game errors: straight "…" quotes → “ ”, ‘ ’ inside them; "..." → …; " - " as a separator ("Redução de ruído - segundo passe") → a colon.
- Game term: Elementos for assets.

## pt-PT

- European usage throughout: captura de ecrã, partilhar.
- The game ships only pt-BR: a setting named in prose keeps the game's Brazilian name, so the player finds it; a category chip takes the European word.
- A bare possessive as a label takes its article ("Os teus"); a label agreeing with several masculine items agrees masculine ("Todos").

## ru-RU

- « » quotes; no dashes even where Russian would put one: "это", a colon or a comma carries the clause.
- ё in the file's own prose (счётчик, её), where the game writes е; a game term keeps the game's spelling.
- Game errors: straight "…" quotes → « »; "..." → …; a spaced en dash or hyphen as тире ("Таксопарк – центр", "**Карта** - **Рабочая среда**") → rephrased.
- Game term: Объекты for both assets and props; a string that tells them apart gives props a distinct word (Пропсы).

## zh-HANS

- 模组 for mod; “ ” quotes, 《》 for titles, …… for the ellipsis, full-width ，：；！？（）.
- Spaces around Latin words and numbers.
- Game errors: a half-width ? or ( ) after Chinese ("NodeJS {NODEJS_VERSION}?其他") → full-width.

## zh-HANT

- Taiwan usage: 模組, 資產, 螢幕截圖.
- 「」 quotes, 『』 inside them; …… for the ellipsis; full-width ，：；！？（）; spaces around Latin words and numbers.
- A label before a placeholder that may start with a digit or a word takes a full-width colon ("時間：{WHEN}") so the spacing holds either way.
- A two-character noun that also reads as a verb takes a qualifier as a column header.
- Game errors: half-width ( ) around Chinese ("教廷 (梵蒂岡城國)") → （）.

## This mod's locale files

What each locale file settled for the mod's own strings: its form of address, the gender it gives "mod", its words for the mod's concepts. A line here wins over the sections above for its locale.

### Every locale

- The mod's own concepts: creator, playset, asset, mod, screenshot.
- A string that extends one of Skyve's verdict labels starts from that label in `HallOfFame/Locales/Skyve/<locale>.json`.
- A weather or climate value takes the national forecast vocabulary.

### de-DE

- Die Mod is feminine in this file, where the game also writes der Mod, so every label agreeing with it agrees feminine.
- The game hyphenates "Paradox-Mods"; the file writes "Paradox Mods".

### es-ES

- The file writes "Paradox Mods" where the game says "Mods de Paradox".

### fr-FR

- Vous in sentences.
- "map" is a Paradox Mods map asset, "carte" the city's map; "asset" and "playset" stay English.
- "sous une autre latitude".
- The file writes "Paradox Mods" where the game says "Mods Paradox".

### it-IT

- Mod is feminine in the file's newer strings; a label agreeing with a row agrees feminine.

### ja-JP

- Examples: "{WHEN}に" for a relative date's particle; 撮影条件 rather than 条件 for a vague heading.
- The hemisphere word comes before the angle (北緯 {ANGLE}°); サブスク is a subscription service, not a count of subscribers.
- Game term: Temperature is 色気温.

### ko-KR

- Older strings wrote 애셋.
- 게시자 for creator, 사용자님 for "you"; a version is a basis ("기준으로"); the hemisphere word comes before the angle (북위 {ANGLE}°).
- The forecast scale has five steps: 맑음, 대체로 맑음, 구름 조금, 구름 많음, 흐림.

### nl-NL

- Je. Auteur for creator.

### pl-PL

- Ty with capitalized Twój; the viewer is addressed in the masculine past tense.
- The mod's showcased asset is "obiekt".

### pt-BR

- "modo foto" lowercase.
- The mod's showcased asset is "recurso".
- Game terms: "Tingir" for Tint, "Balanceamento com o branco".

### pt-PT

- Tu. Criador, conjunto for playset, recurso.
- "Avaliar" for reviewing: "revisor" is a proofreader.

### ru-RU

- Набор for playset, ассет; hemispheres as с. ш. / ю. ш.; a Skyve label in the neuter.

### zh-HANS

- The proofreader's terms win over the game's: 照相模式 (the game says 照片模式), 配组 for playset where older strings still say "playset", 您, 城市画廊 for Hall of Fame.
- 度 is the degree sign, after the placeholder (北纬{ANGLE}度); the hemisphere word comes first.

### zh-HANT

- 創作者, 照相模式; Playset stays in Latin letters.
- The hemisphere word comes before the angle (北緯 {ANGLE}°).
- Game terms: 暈色 for Tint, 一日中的時間 for Time of Day.
- Examples: "審核時間：{WHEN}" for the full-width colon; 訂閱數, 更新時間 for a qualified column header.
