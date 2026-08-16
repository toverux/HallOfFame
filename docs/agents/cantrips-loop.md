# The cantrips loop in this repo

What the six storage verbs translate to here, and which knowledge stores are enabled.
Storage-touching skills read this doc instead of the plugin defaults.
`/setup-cantrips-loop` wrote it; re-run that skill to change it.

## Storage backend

Local markdown under `.scratch/<feature>/`, with `<feature>` a kebab-case slug.
`.scratch/` is already listed in `.gitignore`, so a write there needs no gitignore check: the folder holds disposable working material, not a record, and the durable outcome lives in code, git history, and the knowledge stores below.
Closing a finished feature is the human's act: the user deletes `.scratch/<feature>/` once it no longer serves. No verb does this.

- **Publish the spec** (`publish-spec`) — write the spec to `.scratch/<feature>/spec.md`.
- **Fetch the spec** (`fetch-spec`) — read `.scratch/<feature>/spec.md`.
- **Annotate the spec** (`annotate-spec`) — append the note under a `## Comments` heading at the end of the spec file, each entry prefixed with its date; the body above that heading stays frozen.
- **Publish the tickets** (`publish-tickets`) — write one file per ticket to `.scratch/<feature>/NN-<slug>.md`, numbered from `01` in dependency order, blocking edges as the ticket body's "Blocked by" prose; the shared folder is what ties a ticket to its parent spec.
- **Fetch the ticket** (`fetch-ticket`) — read the ticket file.
- **Resolve the ticket** (`resolve-ticket`) — add or flip a `Status: resolved` line directly under the ticket's title; the verified acceptance-criterion checkboxes remain as evidence.

Three invariants hold whatever the backend: an annotation appends without touching what is already there and stays time-ordered; an annotation recording a revised decision governs over the body it revises, so later readers judge the spec as amended; and a published ticket is traceable to its parent spec.

## Knowledge stores

- `docs/adr/` — **enabled**.
- `docs/solutions/` — **enabled**.
