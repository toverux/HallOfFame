using System;
using System.Collections.Generic;
using System.Globalization;
using Colossal.Json;

namespace HallOfFame.Domain;

/// <summary>
/// The conditions a screenshot was taken in, an open map of names to numbers, text, or booleans
/// that the mod recorded at upload and the server returns as is.
/// Each value keeps its JSON type: a <see cref="double"/>, a <see cref="string"/>, or a
/// <see cref="bool"/>.
/// </summary>
[JsonConverter(typeof(Converter))]
internal sealed class RenderConditions : Dictionary<string, object> {
  /// <summary>
  /// Colossal.Json decodes no value into <see cref="object"/>, so the map is read from its raw
  /// JSON object.
  /// </summary>
  internal sealed class Converter : IJsonConverter {
    public Variant ObjectToJson(object value) => throw new NotSupportedException();

    public object ObjectFromJson(Variant data) {
      var conditions = new RenderConditions();

      if (data is not ProxyObject proxyObject) {
        return conditions;
      }

      // net48's KeyValuePair has no deconstruction.
      foreach (var entry in proxyObject) {
        object? decoded = entry.Value switch {
          ProxyNumber number => number.ToDouble(CultureInfo.InvariantCulture),
          ProxyString text => text.ToString(CultureInfo.InvariantCulture),
          ProxyBoolean boolean => boolean.ToBoolean(CultureInfo.InvariantCulture),
          _ => null
        };

        // The server accepts no other kind of value; one is dropped rather than failing the
        // screenshot's decode.
        if (decoded is not null) {
          conditions[entry.Key] = decoded;
        }
      }

      return conditions;
    }
  }
}
