using System.Collections.Generic;
using System.Linq;
using Colossal.UI.Binding;

namespace HallOfFame.Tests.Utils.Writers;

/// <summary>
/// Handwritten <see cref="IJsonWriter"/> test double recording the property names written under
/// each type name, the shape cohtml caches by that name.
/// One writer may serve several writes, so a test can compare the shapes they produced.
/// </summary>
internal sealed class ShapeRecordingJsonWriter : IJsonWriter {
  private readonly Stack<(string TypeName, List<string> Properties)> openTypes = new();

  public string debugName => nameof(ShapeRecordingJsonWriter);

  /// <summary>
  /// Every type name written, with each distinct property list written under it.
  /// </summary>
  internal Dictionary<string, List<string>> Shapes { get; } = [];

  /// <summary>
  /// The type names written with more than one property list, which cohtml cannot bind.
  /// </summary>
  internal IEnumerable<string> ConflictingTypeNames =>
    this.Shapes.Where(shape => shape.Value.Count > 1).Select(shape => shape.Key);

  public void TypeBegin(string name) => this.openTypes.Push((name, []));

  public void TypeEnd() {
    var (typeName, properties) = this.openTypes.Pop();
    var shape = string.Join(",", properties);

    if (!this.Shapes.TryGetValue(typeName, out var shapes)) {
      this.Shapes[typeName] = shapes = [];
    }

    if (!shapes.Contains(shape)) {
      shapes.Add(shape);
    }
  }

  public void PropertyName(string name) => this.openTypes.Peek().Properties.Add(name);

  public void MapBegin(uint size) {
  }

  public void MapEnd() {
  }

  public void ArrayBegin(uint size) {
  }

  public void ArrayEnd() {
  }

  public void WriteNull() {
  }

  public void Write(bool value) {
  }

  public void Write(int value) {
  }

  public void Write(uint value) {
  }

  public void Write(long value) {
  }

  public void Write(ulong value) {
  }

  public void Write(float value) {
  }

  public void Write(double value) {
  }

  public void Write(string value) {
  }
}
