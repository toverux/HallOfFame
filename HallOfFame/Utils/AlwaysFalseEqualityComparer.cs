using System.Collections.Generic;

namespace HallOfFame.Utils;

internal class AlwaysFalseEqualityComparer<T> : EqualityComparer<T> {
    public override bool Equals(T x, T y) => false;

    public override int GetHashCode(T obj) => 0;
}
