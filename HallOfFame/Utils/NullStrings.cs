using System.Linq;
using System.Reflection;

namespace HallOfFame.Utils;

internal static class NullStrings {
  /// <summary>
  /// <para>
  /// Restores the default of every public read-write string property of <paramref name="target"/>
  /// that is null while it is not in <paramref name="defaults"/>, an instance of the same type that
  /// has only been through its defaults.
  /// </para>
  /// <para>
  /// The game loads a settings <c>.coc</c> file with <c>JSON.WriteInto</c>, which applies every key
  /// present in the file over the values the constructor just defaulted, an explicit JSON
  /// <c>null</c> included.
  /// A null that reaches the file therefore outlives every restart: <c>SetDefaults()</c> runs, the
  /// file overwrites it with null again, and the next save writes that null right back.
  /// </para>
  /// <para>
  /// The vanilla options UI renders a <c>[SettingsUIDropdown]</c> string as
  /// <c>DropdownField&lt;string&gt;</c>, which writes the value through the non-nullable
  /// <c>StringWriter</c>, so such a null throws in <c>OptionsUISystem.OnUpdate</c> and the whole
  /// options page stops rendering, the mod's and every other mod's alike, leaving the user no way
  /// to fix the setting from the UI.
  /// </para>
  /// <para>
  /// Only strings are repaired.
  /// A value type sitting at <c>default(T)</c> is indistinguishable from a deliberate choice, so a
  /// disabled toggle or a zeroed slider cannot be told apart from corruption and is left alone.
  /// A string the defaults leave null too is left null, as it is meant to be nullable.
  /// </para>
  /// </summary>
  internal static void Restore<T>(T target, T defaults) where T : class {
    var properties = target
      .GetType()
      .GetProperties(BindingFlags.Public | BindingFlags.Instance)
      .Where(static property =>
        property.PropertyType == typeof(string) &&
        property.GetIndexParameters().Length is 0 &&
        property.GetGetMethod() is not null &&
        property.GetSetMethod() is not null
      );

    foreach (var property in properties) {
      if (property.GetValue(target) is null && property.GetValue(defaults) is string value) {
        property.SetValue(target, value);
      }
    }
  }
}
