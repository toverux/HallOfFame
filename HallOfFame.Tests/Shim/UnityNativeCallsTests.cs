using Unity.Collections;
using Xunit;

namespace HallOfFame.Tests.Shim;

/// <summary>
/// The Unity.Collections uses the native-call shim makes work off-engine, with real allocators.
/// </summary>
public sealed class UnityNativeCallsTests {
  [Theory]
  [InlineData(Allocator.Temp)]
  [InlineData(Allocator.TempJob)]
  [InlineData(Allocator.Persistent)]
  public void NativeArray_AllocatesClearedMemory(Allocator allocator) {
    var array = new NativeArray<int>(64, allocator);

    try {
      Assert.All(array, static value => Assert.Equal(0, value));

      array[63] = 42;

      Assert.Equal(42, array[63]);
    }
    finally {
      array.Dispose();
    }
  }

  [Fact]
  public void NativeArray_CopiesFromManaged() {
    using var array = new NativeArray<int>([1, 2, 3, 4], Allocator.Temp);

    Assert.Equal([1, 2, 3, 4], array.ToArray());
  }

  [Fact]
  public void NativeList_GrowsPastItsInitialCapacity() {
    using var list = new NativeList<int>(1, Allocator.Persistent);

    for (var i = 0; i < 10_000; i++) {
      list.Add(i);
    }

    Assert.Equal(10_000, list.Length);
    Assert.Equal(9_999, list[9_999]);
  }

  [Fact]
  public void NativeList_Sorts() {
    using var list = new NativeList<int>(Allocator.Temp);

    for (var i = 100; i > 0; i--) {
      list.Add(i);
    }

    list.Sort();

    Assert.Equal(1, list[0]);
    Assert.Equal(100, list[99]);
  }

  [Fact]
  public void NativeHashMap_GrowsAndLooksUp() {
    using var map = new NativeHashMap<int, int>(4, Allocator.Persistent);

    for (var i = 0; i < 1_000; i++) {
      map.Add(i, i * 2);
    }

    Assert.Equal(1_000, map.Count);
    Assert.Equal(1_998, map[999]);
    Assert.False(map.ContainsKey(1_000));
  }

  [Fact]
  public void NativeParallelHashMap_GrowsAndLooksUp() {
    using var map = new NativeParallelHashMap<int, int>(4, Allocator.TempJob);

    for (var i = 0; i < 1_000; i++) {
      Assert.True(map.TryAdd(i, i));
    }

    Assert.Equal(1_000, map.Count());
    Assert.True(map.TryGetValue(500, out var value));
    Assert.Equal(500, value);
  }

  [Fact]
  public void NativeQueue_IsFirstInFirstOut() {
    using var queue = new NativeQueue<int>(Allocator.Temp);

    for (var i = 0; i < 500; i++) {
      queue.Enqueue(i);
    }

    Assert.Equal(0, queue.Dequeue());
    Assert.Equal(499, queue.Count);
  }

  [Fact]
  public void FixedString_Appends() {
    FixedString64Bytes text = "Main Street";

    text.Append(" 12");

    Assert.Equal("Main Street 12", text.ToString());
  }
}
