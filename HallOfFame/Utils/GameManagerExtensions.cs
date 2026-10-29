using Game;
using Game.SceneFlow;

namespace HallOfFame.Utils;

internal static class GameManagerExtensions {
  extension(GameManager gameManager) {
    /// <summary>
    /// Whether the main menu is loaded, its loading completion already announced to the systems.
    /// A system created then never receives that announcement for this menu, so it replays it at
    /// creation: the game loads Paradox Mods' mods once its boot is over when the Paradox login and
    /// the mod sync outlast it, which can land after the main menu loaded.
    /// While the menu loads, the mode already reads main menu but the state reads loading, and the
    /// announcement is still to come.
    /// </summary>
    internal bool IsMainMenuLoaded =>
      gameManager is { gameMode: GameMode.MainMenu, state: GameManager.State.WorldReady };
  }
}
