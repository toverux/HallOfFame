# Paradox Mods previews

The mod's Paradox Mods gallery images live in `~/Documents/Hall of Fame/Previews.af`: six 1920×1080 px slides at 72 dpi, so a font size in points is its height in pixels on the slide.
They are edited live through the `affinity` MCP tools; load the `affinity-wine` skill before the first call.

## Style

A flat, punchy store style built from the game's own look. A new slide follows it:

- **Solid colour fields.** Navy, slate and green panels with hard edges; gradients and texture come only from screenshots.
- **Two layouts.** Three panels split by diagonals leaning about 7° (slides 1 and 6), or horizontal title and footer bars framing a full-width screenshot (slides 3 and 4).
- **The game is the imagery.** Full-bleed or panel-clipped city screenshots, and the mod's real UI captured in situ, never redrawn. A pointer cursor marks the thing to click.
- **Few words, big type.** Short phrases in Cities 0.4, the game's display face, often split across the slide so they read as one sentence ("Your city … on the main menu"); figures run large over small labels. Supporting copy is Overpass, the game UI's face.
- **White text only**, set straight on the colour fields, with no outline or shadow.
- **Green is the accent:** callout boxes and pills with round corners, the one panel that draws the eye. Navy is the ground.
- **One illustration per slide at most**, and only where it carries the message: the magnifier on the 4K slide, the trophy line art as a 20% watermark.

## Palette

| Name         | Hex       | Use                                                      |
| ------------ | --------- | -------------------------------------------------------- |
| Navy         | `#101b30` | Backdrops, left panels, title bars                       |
| Slate        | `#2e3241` | Middle panels and bands                                  |
| Viewer grey  | `#212529` | Slide 6 middle panel, the Viewer's own background        |
| Viewer patch | `#2b3035` | Slide 6 cover patch over the Viewer capture              |
| Green        | `#5abe41` | Paradox Mods' green: right panels, callouts, the 4K band |
| White        | `#ffffff` | All text; credits and dates at reduced opacity           |

A new shape takes its colour from this table, so the palette stays exact to the unit.

## Type

| Role                                            | Font                           | Size    |
| ----------------------------------------------- | ------------------------------ | ------- |
| Title                                           | Cities 0.4 Regular             | 96      |
| Title, secondary line                           | Cities 0.4 Regular             | 72      |
| Stat figure / stat label                        | Cities 0.4 / Overpass SemiBold | 96 / 72 |
| Secondary text, short lines                     | Overpass SemiBold              | 48      |
| Secondary text, dense (captions, labels, lists) | Overpass SemiBold              | 36      |
| Credit                                          | Cities 0.4 Regular             | 22.5    |
| Stats date range                                | Overpass SemiBold, alpha 112   | 30      |

Overpass resolves as `OverpassRoman-SemiBold`, the static instance `affinity-wine` describes. Mock game UI (the slide 1 tooltip) keeps the game's own sizes.

## Layout

- Margins are 60 px on every edge, measured on what renders: a text's ink, or a box's outer edge, stroke included. The slide 4 caption box is a frame with a 40 px centred green stroke, so its visible edge sits 20 px outside the frame; the slide 5 label pill's 20 px stroke reaches 10 px out.
- Credits sit outside the margin grid, small and discreet.
- Slides 1 and 6 share the diagonal three-panel layout with identical panel geometry. Move one slide's panels and the other's follow, or the edges jump when the gallery flips between them.
- Every layer carries an English name describing its role. Each slide groups its layers into top-level containers by role: `Background` first, then content groups (`Text`, `Titles`, `Credits`, a mock UI card).

## Design choices

These are deliberate; a review leaves them as they are.

- White text on the green, at about 2.4:1 contrast: the green is Paradox Mods' own.
- The slide 4 magnifier shows its crop upscaled: the zoom effect is the point.
- Slide 6 reads "discords, youtube, twitch" in lowercase, and dates read `MM/YYYY`.
- A creator is credited by the name the slide's context shows: the slide 1 credit reads "Jason Stephen", the slide 3 game UI "bilibili Jason Stephen".
- Slides 1 and 4 title in Title Case, the others in sentence case.
- The slide 1 mock card is cropped at the slide edge, mid-chip.
- "& Maps" on slide 1 is indented with spaces.
- Layout tricks hidden in the text: the last "/" of the slide 3 features list is transparent, to keep the right-aligned lines flush; slide 4 stacks `Title` over `Title outline` for the pixel-font "800x600", and its leading "4K" is transparent under the `4K icon`.

## Stats

The slide 6 figures come from the production database, read-only, through the SSH tunnel of `HallOfFameServer`'s `import-database` task (`mise -E remote exec` loads its env):

- users: `db.creators` count
- likes: `db.favorites` count
- screenshots: `db.screenshots` count
- views: `db.views` count

Each label is the count cut down to a nice number, with a `+`: 15,645 reads `15K+`, 2,240,315 reads `2.2M+`.
The date range runs from `09/2024`, the first creator, to the month of the refresh.

## Review workflow

- Apply one fix at a time and send the user a before/after contact sheet: both full slides, then 2× crops of what changed, with the 60 px margin drawn when the fix is about alignment. Crop from full-size exports where `affinity-wine` says export works. The next fix waits for their verdict.
- A structural change (regrouping, renaming, reordering) must render identically: diff the renders before and after, and report any pixel that moved.
- Copy `Previews.af` aside before saving; the folder has no sync or versioning.

## Publishing

1. Export each slide with the `PNG` preset at its document size: slide N becomes `HallOfFame/Properties/Preview_N.png`, in the order `PublishConfiguration.xml` lists them. `Thumbnail.png` is drawn separately.
2. `mise publish:page` uploads them, after `mise images:optimize` has cut the previews to 256 colours; the task's comment in `mise.toml` holds why.
