**Faster, cleaner captures.**

Hall of Fame takes 4K pictures, which can put a strain on modest machines, especially when they are short on VRAM.
I did my best to speed up the process, testing across three different machines and with many configurations each, and optimized the mod as much as the game would allow. The mod now behaves better with the rendering engine, HDRP, and allows it to reclaim VRAM, and other improvements made the process more responsive overall.

- The capture now freezes the game much more briefly.
- The mod no longer needs to hide the game UI, and a white flash marks the shot inviting you to wait an instant (avoiding users thinking the game froze).
- The upload panel opens faster on the preview while the full image encode is done in the background.
- Captures now render at the 4K size the server keeps, instead of up to twice your screen's size on screens between 1080p and 4K, such as 1440p. So that too, speeds up capture time on many setups with no quality loss.
- After a capture, the game no longer runs slower (especially on more modest graphics cards) or holds extra graphics memory for the rest of the session: it frees them when you close photo mode.
- DLSS, FSR and XeSS are all switched off just during the capture (so no shot renders below its size), and anti-aliasing is set to SMAA High.
- Global illumination is now turned off during every capture (no longer just on Nvidia cards), so shots are no longer grainy on AMD and Intel cards either.
- Fixed captures potentially failing with an error when the game was not signed in to a Paradox account (collecting showcasable mod tags).
- Other minor improvements.
- Spanish corrections, thanks to elGendo87!
