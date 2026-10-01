---
date: 2026-10-01
area: Http
symptoms:
  - 'Unhandled exception out of Unity completion pump after the request already succeeded'
  - 'UnityWebRequest has already been sent; cannot modify the timeout'
tags: [unitywebrequest, async, await, engine-defect]
---

# Awaiting a web request resumes the caller twice

## Problem

`await request.SendWebRequest()` can resume the awaiting method a second time. That resume re-enters
the async method from the top and throws at the first line rejecting an already-sent request, and
since the caller's await already completed, nothing in the mod can catch it: it surfaces as an
unhandled exception out of Unity's completion pump, after the request itself succeeded.

## Root cause

The defect is in the game's code. `Game.UnityWebRequestExtensionMethods.UnityWebRequestAwaiter`
subscribes in its constructor and fires again inline:

```csharp
public UnityWebRequestAwaiter(UnityWebRequestAsyncOperation asyncOp) {
  this.asyncOp = asyncOp;
  this.asyncOp.completed += OnRequestCompleted;
}

public void OnCompleted(Action continuation) {
  this.continuation = continuation;
  if (IsCompleted) { OnRequestCompleted(asyncOp); }
}
```

`OnRequestCompleted` is `continuation?.Invoke()`, with neither an unsubscribe nor an already-invoked
guard, so both paths survive when `isDone` turns true between the state machine's `IsCompleted` read
and `OnCompleted`'s: the inline call runs immediately, the queued `completed` handler runs later.
`isDone` is `result != Result.InProgress` over native state the transfer threads flip off the main
thread, so that window is reachable; it spans the `ExecutionContext` capture and the first-await
boxing, which a GC pause widens.

Any mod binds this awaiter wherever `using Game;` is in scope.

## Fix

Poll the operation, which binds no awaiter:

```csharp
var operation = request.SendWebRequest();

while (!operation.isDone) {
  await Task.Yield();
}
```

Nothing is lost by not awaiting it: the awaiter's `GetResult()` returns `asyncOp.webRequest.result`
and never throws, so every error path already reads `request.result` for itself. Holding the
operation in a local also keeps it from being finalized while the request is in flight.

## Prevention

Every request goes through `HttpQueries.SendRequest`, which owns the poll loop.
