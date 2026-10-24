---
date: 2026-10-24
area: UI
symptoms:
  - 'Closing the dashboard from the detail view flashes the grid as the panel fades out'
tags: [cs2-ui, modal, transition, exit, binding, props]
---

# A closing modal swaps its content as it fades

## Problem

Closing the Creator Dashboard from its detail view showed the grid for the length of the exit
fade, as though Back had been pressed first.

## Root cause

While its exit plays, a closing modal keeps the element it was last rendered with, so its props
freeze; a binding hook read inside it still re-renders it on every C# publish.
`DashboardModal` read the detail binding itself, and `DashboardService.Close()` closed the detail
after the dashboard, so the fading panel re-rendered with no detail and fell back to the grid.

## Fix

Read every binding a closing modal renders from in the component outside the `ModalHost`, and pass
it in as a prop (`creator-dashboard.tsx`, `CreatorDashboard`):

```tsx
const detail = bindings.useDashboardDetail();

return (
  <ModalHost>
    {state.status != 'closed' && <DashboardModal key='dashboard' state={state} detail={detail} />}
  </ModalHost>
);
```

C# publishes the dashboard's close before the detail's (`DashboardService.Close()`): the other
order leaves a frame where the open modal renders the grid before it starts to fade.

## Prevention

`creator-dashboard.test.tsx`, "keeps the detail on screen while the panel closing from it plays
its exit", and `DashboardServiceTests.Close_ClosesTheDashboardThenItsDetail` pin both halves.
