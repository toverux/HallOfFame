This updates delays a bit the loading of a Hall of Fame background image.

Before, the mod attempted to load an image as soon as possible to display it instantly when the menu was shown.

However, on lower-end machines or with large mod playsets, this could cause more noticeable UI stuttering when loading mods.

Furthermore, this could also have played a role in the elusive crash that some players experience when opening the game.

This update waits for the main menu to be shown *and* waits 500ms more before doing anything.

**These changes are experimental, if they don't yield good results they might be reverted.**

If you used to experience the crash-at-load and still have it after this update, *please* contact me on Discord or in the Forum thread to report it.
