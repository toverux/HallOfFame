using System.Collections.Generic;

namespace HallOfFame.Utils;

/// <summary>
/// A comparer for which no two values are equal, not even a value and itself.
/// A <c>ValueBinding</c> sends an update only for a value its comparer tells apart from the last
/// one, so with this comparer every <c>Update()</c> reaches the UI: for a mutable object updated in
/// place (the settings, for one), or a struct whose default equality misses a change.
/// </summary>
internal sealed class AlwaysFalseEqualityComparer<T> : EqualityComparer<T> {
  public override bool Equals(T x, T y) => false;

  public override int GetHashCode(T obj) => 0;
}
