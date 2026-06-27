using System;
using HallOfFame.Logging;

namespace HallOfFame.Tests.Logging;

/// <summary>
/// No-op <see cref="IModLog"/> test double.
/// Logging is a side effect the service tests do not assert on, so every method discards its
/// arguments; this keeps the engine-bound real logger out of the off-engine test runtime.
/// </summary>
internal sealed class FakeModLog : IModLog {
  public void Verbose(string message) {
  }

  public void Info(string message) {
  }

  public void Warn(string message) {
  }

  public void Warn(Exception exception, string message) {
  }

  public void Error(string message) {
  }

  public void ErrorSilent(string message) {
  }

  public void ErrorSilent(Exception exception) {
  }

  public void ErrorSilent(Exception exception, string message) {
  }

  public void ErrorRecoverable(Exception exception) {
  }

  public void ErrorFatal(Exception exception) {
  }
}
