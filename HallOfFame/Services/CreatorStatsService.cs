using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;

namespace HallOfFame.Services;

/// <summary>
/// Holds the product rule deciding whether the creator's stats are notable enough to be surfaced
/// in a notification.
/// </summary>
internal sealed class CreatorStatsService(IHallOfFameApi api) {
  /// <summary>
  /// Minimum number of likes for the stats to be deemed notable enough to notify the creator.
  /// </summary>
  private const int MinLikesToNotify = 2;

  /// <summary>
  /// Fetches the creator's stats and returns them only if they are notable enough to be shown, or
  /// <c>null</c> otherwise.
  /// Errors from the API are propagated to the caller.
  /// </summary>
  internal async Task<CreatorStats?> GetNotableStats() {
    var stats = await api.GetCreatorStats();

    return stats.LikesCount < CreatorStatsService.MinLikesToNotify ? null : stats;
  }
}
