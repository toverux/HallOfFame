# ﻿<img src="logo.png" alt="Hall of Fame logo" align="right" style="width: 256px">Hall of Fame for Cities: Skylines II

[![Discord](https://img.shields.io/badge/Discord-@toverux-5865f2?logo=discord&logoColor=white)](https://discord.gg/SsshDVq2Zj)
[![Paradox Mods](https://img.shields.io/badge/Paradox_Mods-Hall_of_Fame-5abe41)](https://mods.paradoxplaza.com/mods/90641/Windows)
[![Crowdin](https://badges.crowdin.net/halloffame-cs2/localized.svg)](https://crowdin.com/project/halloffame-cs2)

A Cities: Skylines II mod that allows players to take and upload screenshots of their city and share
them with the community.

Screenshots are uploaded to a server and can be viewed by other players as a background image in the
main menu, with information about the creator, the city name and controls to refresh the image,
upvote or hide the UI to better see the image, to name a few features.

The source code for the server is at
[toverux/HallOfFameServer](https://github.com/toverux/HallOfFameServer)

### Acknowledgements

The mod is directly inspired from the homonymous mod for Factorio,
[Hall of Fame](https://mods.factorio.com/mod/HallOfFame).
[Loading Screen Mod Revisited](https://steamcommunity.com/sharedfiles/filedetails/?id=2858591409)
for Cities: Skylines 1 also provided a similar feature.<br>
Both mods featured hand-picked screenshots, whereas this mod allows everyone to share their
creations.

Special thanks to:

- The Cities: Skylines Modding Discord community in general for their help and kind support.
- **[Chamëleon TBN](https://linktr.ee/chameleon_tbn)** for providing some icons the mod uses and algernon for the
  [Unified Icon Library](https://github.com/algernon-A/UnifiedIconLibrary).
- **CloverPie, Danil.V.L, Hendrix, Jojodaisuke, Konsi, Prophedt, TheBusStop, ThemisC2, Tigon
  Ologdring**, for having tested the mod and uploaded the first content, so we have beautiful images
  on launch.
- **ThemisC2** for his hum, relentless support to help me finally finish a personal project.

## Features & Roadmap

**Notable features**:

- Supersampling all screenshots you make to **4K** resolution even if you play at a lower
  resolution, and makes better renders than the game’s native screenshot tool.
- Have pictures displayed in the main menu, with various information about the city, author, etc.
- Give a like to the pictures you appreciate and see popular pictures.
- Toggle menu UI visibility to admire the pictures (like a slideshow).
- Fine-tune how the algorithm chooses screenshots that are presented to you (recent screenshots,
  trending, ancient and forgotten, etc.).
- Make screenshots and upload them via a dedicated interface, all in-game.
- Choose between Full HD and 4K resolution for pictures shown in the main menu.

**Roadmap:** see our feedback & feature requests board here:
[feedback.halloffame.cs2.mtq.io/](https://feedback.halloffame.cs2.mtq.io)

## Development

### Installation

1. Standard CS2 modding toolchain;
2. (Recommended) Install [mise-en-place](https://mise.jdx.dev) for per-project Node.js & Bun
   version management. Without mise, just match the required versions specified in `mise.toml`.
   For now, Node is still and only needed alongside Bun to run Webpack
   (https://github.com/oven-sh/bun/issues/10768).
3. `bun i` to install UI mod dependencies.
4. Recommended: enable `--developerMode --uiDeveloperMode` as game launch options.

Here's a game launch command to also skip the launcher in Steam:

```sh
"C:\Program Files (x86)\Steam\steamapps\common\Cities Skylines II\Cities2.exe" %command% --developerMode --uiDeveloperMode
```

### Development workflow

The UI mod will be built automatically with the C# solution.

However, if you are actively working on the UI, you may recompile it on change with `bun dev`.

You can enable the game's UI live reload on change with `--uiDeveloperMode`.

Debugging C# code can be done following these steps: https://cs2.paradoxwikis.com/Debugging.

Debugging JS code can be done with the browser's dev tools by opening http://localhost:9444 (sadly
not working well on Firefox, Chrome is recommended).

Logs are situated in either:

- `%appdata%\LocalLow\Colossal Order\Cities Skylines II\Player.log`
- `%appdata%\LocalLow\Colossal Order\Cities Skylines II\Logs\UI.log`
- `%appdata%\LocalLow\Colossal Order\Cities Skylines II\Logs\HallOfFame.log`

### Publishing a new version

- Update `Version` and `FileVersion` in `HallOfFame/HallOfFame.csproj`;
- Update `ModVersion` in `HallOfFame/Properties/PublishConfiguration.xml`;
- Update `version` in `HallOfFame/UI/mod.json`;
- Update `HallOfFame/ChangeLog.md` *with only what's changed since the last version*;
- Update `HallOfFame/LongDescription.md` if needed;
- Run the `PublishNewVersion` publish configuration from the IDE or with
  `dotnet publish /p:ModPublisherCommand=NewVersion`;
- Tag version in git with `vX.Y.Z`.

## Code style

### TypeScript

TypeScript code is formatted and linted by [Biome](https://biomejs.dev).
Run `bun check` to check for linting errors, format files and autofix simple issues.

You can also use Biome directly with `bun biome`.

The formatter and linter should run as a pre-commit hook if you have it installed,
which should be done automatically when running `bun i` (otherwise run `bun lefthook install`).

I'd suggest using a Biome plugin for your editor to ease development.

If a rule seems out of place for this project, you can either disable/reconfigure it in the
`biome.json` file or disable it with an annotation comment, but these should be justified and
concerted.

### C#

For C#, prefer using Rider, as code style and linting settings are saved in the project.
Reformat your code before committing (CTRL+ALT+L with Rider).

At the very least, please ensure your IDE has `.editorconfig` support enabled.

### Commit messages

Commits must follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0)
specification and more specifically, the Angular one.

Scope can be one or more of the following:

- `mod`: for general changes to how the mod "presents itself" to the game or
  user;
- `cs`: for C# mod changes;
- `ui`: for UI mod changes;
- `options`: for changes in the mod options;
- `menu`: for changes in the main menu part of the mod;
- `game`: for changes in the in-game part of the mod;
- `i18n`: for changes in translation files and translations system;
- `deps`: for dependencies updates;
- `chore(release)`: for new releases (bump version, update changelog, etc.);
- Propose new scopes if needed!
