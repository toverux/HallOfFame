---
date: 2026-08-19
status: accepted
area: UI/components
---

# The mod owns its tooltip component

## Context

The vanilla `Tooltip` hands the balloon `direction` and `alignment` as flat props, and the balloon
reads them off its `balloonUiTarget` instead. Every tooltip placed through it therefore opens
upwards, whatever it asked for.

Three options were live: accept upward-only tooltips; reach past the vanilla component only at the
call sites that need placement, leaving the mod with two tooltip components whose props differ in
ways nothing warns about; or own one tooltip mod-wide.

## Decision

The mod owns `HallOfFame/UI/src/components/tooltip.tsx` and uses it for every tooltip, placement or
not, driving the same `AnchoredBalloon` through `balloonUiTarget`, the channel it actually reads —
so it keeps working either way should the game reconnect the props.

One component mod-wide rather than two, because a per-site choice between two near-identical
tooltips is a trap that pays off only in the moment it is made.

## Consequences

- Tooltips open where they are asked to.
- Tooltips no longer show on gamepad focus: the vanilla one drives that off an input observable the
  bundle does not export. This is the price of the decision, accepted.
- The mod tracks the balloon's API rather than the tooltip's, a narrower and more stable surface.
- A tooltip cannot be observed in a component test — see the `hof-ui-testing` skill.
