**“The Screenshot Quality Update”**

**New features and changes:**
- Add maximize button on the upload dialog preview image, allowing you to review the screenshot in full screen before sending.
- When the option for saving screenshots locally is enabled (it is by default), the mod will no longer use the Vanilla code for this (and hence take the screenshot two times, also).
  Instead, Hall of Fame now saves its own file in the game’s Screenshots folder, using the same naming scheme as the Vanilla game.
  This will allow you to take 4K screenshots locally no matter your actual game resolution, and benefit from the other improvements below.
  If you want to take a Vanilla screenshot, just use the Vanilla button.
- A warning will be shown in the upload dialog if you took the screenshot using non-High graphics quality settings, encouraging you to switch to High for the screenshotting session.
  Custom settings are ignored.
- (Nvidia GPUs) Disable Global Illumination (SSGI) when taking a screenshot.
  This is because SSGI implementation in C:S 2 causes very grainy images that you are now probably familiar with if you’ve used the mod a lot, so much that it can completely ruin the screenshot.
  For now, SSGI is only disabled with Nvidia GPUs, I will be monitoring new screenshots to see if it happens with AMD GPUs as well.
  You can disable the SSGI override in the mod’s option menu if you know that it doesn’t cause issues with your GPU.
  A small message will be displayed in the upload dialog if the mod disabled SSGI for the screenshot.
- Disable Nvidia DLSS or the game’s native upsampling, as they don’t make sense when we are already taking a supersampled screenshot.
  They only caused blurrier images or artifacts.
- Make more render cycles (1 → 8) when taking a screenshot, improving texture and geometry precision, especially on far away objects.
- Screenshots are now sent to the server in the original PNG quality, and no longer in 75% quality JPEG, improving the quality at the source.
  They are still converted and served as JPG for performance reasons, but the resulting image quality will be significantly improved.
- Updates for Spanish, Portuguese, Polish and Chinese Simplified.
