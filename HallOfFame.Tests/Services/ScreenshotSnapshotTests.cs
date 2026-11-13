using System.Collections.Generic;
using System.Threading.Tasks;
using HallOfFame.Services;
using HallOfFame.Tests.Utils.Writers;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class ScreenshotSnapshotTests {
  /// <summary>
  /// The snapshot is published before its full image is ready, then again once it is: cohtml binds
  /// one shape per type name, so the ready flag must be written in both.
  /// </summary>
  [Fact]
  public void Write_BeforeAndAfterTheImageIsReady_WritesTheReadyFlagInOneShape() {
    var jsonWriter = new ShapeRecordingJsonWriter();

    var pending = ScreenshotSnapshotTests.MakeSnapshot(new TaskCompletionSource<byte[]>().Task);

    pending.Write(jsonWriter);

    (pending with {
      ImageFileSize = 3
    }).Write(jsonWriter);

    var shape = Assert.Single(Assert.Single(jsonWriter.Shapes).Value);

    Assert.Contains("isImageReady", shape.Split(','));
  }

  [Fact]
  public void IsSameCapture_ReadyCopy_IsTheSameCapture_AndAnotherCaptureIsNot() {
    var first = ScreenshotSnapshotTests.MakeSnapshot();
    var second = ScreenshotSnapshotTests.MakeSnapshot();

    Assert.True(
      (first with {
        ImageFileSize = 3
      }).IsSameCapture(first)
    );

    Assert.False(second.IsSameCapture(first));
  }

  private static ScreenshotSnapshot MakeSnapshot(Task<byte[]>? imageBytes = null) =>
    new(
      0,
      0,
      null,
      imageBytes ?? Task.FromResult<byte[]>([]),
      0,
      0,
      false,
      false,
      new Dictionary<string, float>(),
      new Dictionary<string, object>(),
      null
    );
}
