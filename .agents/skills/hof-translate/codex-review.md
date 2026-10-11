# Cross-reviewing translations with Codex

The moderator and Codex read the same strings and argue each disagreement to a concession, through the Codex CLI run non-interactively.

## The model

The best model the account allows, always at high effort: the entries of `~/.codex/models_cache.json` whose `visibility` is `list`, lowest `priority` number first.
Probe them in that order until one answers `OK`, before dispatching the moderators, since a plan without the model answers with a 400 that no retry cures:

```
codex exec -m <model> -c 'model_reasoning_effort="high"' -s read-only --skip-git-repo-check --ephemeral 'Reply OK'
```

A "not supported when using Codex with a ChatGPT account" error is the plan, not an outage.
A rate limit or a network error, on the probe or a round: wait a minute, retry, five times.
Give every moderator the model that answered, or no `-m` at all, the account's default, when none did.

## One round

```
codex exec -m <model> -c 'model_reasoning_effort="high"' -s read-only -C <repo> -o <dir>/r1.md - < <dir>/r1-prompt.md > <dir>/r1.log 2>&1
```

- `-s read-only` lets Codex read the repo itself: name the two files and the key range, paste the context and the rules, and ask for findings as key, current text, proposed text, reason, severity (error: meaning, grammar, placeholder, game term; improvement; nit), plus the count of strings accepted as they are.
- The log's header carries `session id: <uuid>`; the `-o` file holds the final message.
- The next round resumes the session with the moderator's reply, which lists what was applied, what is disputed and why, and asks Codex to concede or counter each point and to flag anything new in the applied wording:

```
codex exec resume <uuid> - < <dir>/r2-prompt.md -o <dir>/r2.md > <dir>/r2.log 2>&1
```

- Five rounds at most; a point still open after that stays as the moderator judges and is reported.
- Each moderator gets its own `<dir>`: siblings sharing one overwrote each other's helper scripts.

## Codex's known turns

- It may refuse the review because `AGENTS.md` tells an agent to stop when the game plugins are missing: resume with a line saying the review reads two JSON files and edits nothing.
- It proposes dashes, and it rewrites "broken from the latest patch" as the patch marking the mod, which Skyve's reviewers do: both are declined.
- It reaches for keys outside the range (the tab labels): declined, out of scope.
- `{WHEN}` is "3 days ago": a preposition before it ("on {WHEN}") is a bug it catches and the moderator confirms.
- Its findings on the longer notes are usually right; its label rewrites are usually longer than the room, which is the moderator's call.
