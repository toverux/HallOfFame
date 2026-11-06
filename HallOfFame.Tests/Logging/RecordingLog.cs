using System;
using System.Collections.Generic;
using System.Reflection;
using Colossal.Logging;

namespace HallOfFame.Tests.Logging;

/// <summary>
/// <para>
/// <see cref="ILog"/> test double that records every call, with the "show errors in UI" flag it was
/// made under.
/// </para>
/// <para>
/// <see cref="ILog"/> has a few hundred members, so <see cref="DispatchProxy"/> implements them all
/// and routes each call to <see cref="Invoke"/>.
/// Only <see cref="ILog.showsErrorsInUI"/> keeps state; every other call is recorded and returns
/// the default of its return type.
/// Public and unsealed, as <see cref="DispatchProxy"/> derives the proxy from it.
/// </para>
/// </summary>
public class RecordingLog : DispatchProxy {
  internal List<LogCall> Calls { get; } = [];

  internal bool ShowsErrorsInUI { get; set; } = true;

  internal static (ILog Log, RecordingLog Recorder) Create() {
    var log = DispatchProxy.Create<ILog, RecordingLog>();

    return (log, (RecordingLog) log);
  }

  protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) {
    ArgumentNullException.ThrowIfNull(targetMethod);

    switch (targetMethod.Name) {
      case $"get_{nameof(ILog.showsErrorsInUI)}": return this.ShowsErrorsInUI;
      case $"set_{nameof(ILog.showsErrorsInUI)}":
        // A property setter is always called with its value, a bool.
        this.ShowsErrorsInUI = (bool) args![0]!;

        return null;
      default:
        this.Calls.Add(new LogCall(targetMethod.Name, args ?? [], this.ShowsErrorsInUI));

        return targetMethod.ReturnType.IsValueType && targetMethod.ReturnType != typeof(void)
          ? Activator.CreateInstance(targetMethod.ReturnType)
          : null;
    }
  }
}

/// <summary>
/// An <see cref="ILog"/> call recorded by <see cref="RecordingLog"/>.
/// </summary>
internal sealed record LogCall(string Method, object?[] Args, bool ShowsErrorsInUI);
