# tool-permissions

Per-tool permissions per project, configured in `.pi/permission.json`.
Each tool (`bash`, `read`, `write`, `edit`, custom tools, ...) can be
allowed, gated behind a confirmation prompt, or denied outright.

## Config

`.pi/permission.json` — a flat object mapping a tool name to one of
`allow`, `ask`, or `deny`:

```json
{
  "bash": "ask",
  "write": "deny",
  "*": "allow"
}
```

- `allow` — run without prompting. Unlisted tools are allowed by default.
- `ask` — prompt before the tool runs. The prompt offers three choices:
  **Yes** (allow once), **Yes (this session)** (remember the approval for
  the rest of the session, no more prompts for this tool), and **No**
  (block the call; the model sees a "rejected" reason).
- `deny` — block the call; the model sees a "denied" reason.
- `"*"` — catch-all rule for tools without an explicit entry. Handy for
  deny-by-default, e.g. `{ "*": "deny", "read": "allow", "bash": "ask" }`.

The file is re-read on every tool call, so edits take effect immediately —
no `/reload`. A missing file leaves all tools unrestricted: the extension
is a no-op.

## Behavior notes

- Session grants ("Yes (this session)") are in-memory per tool and are
  cleared on `session_start` — i.e. when a session starts, resumes,
  forks, or reloads. They are not persisted.
- `ask` in non-interactive modes (`-p`, `--mode json`) has no UI to prompt
  with, so the call is blocked with an explanatory reason.
- `ask` prompts show the command (`bash`) or path (`read`/`write`/`edit`/
  ...) when available, otherwise a truncated view of the arguments.
- Invalid rule values are treated as `deny` (fail safe) and reported once
  per session; invalid JSON is reported once and leaves all tools allowed.
- Works for custom tools too: use the tool's registered name.
- `.pi/permission.json` is honored even in untrusted projects. The
  extension can only restrict tools (`deny`/`ask`) — it never grants more
  access than pi already has.
