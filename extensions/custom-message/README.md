# custom-message

Replaces pi's "Working..." text with a line from a text file while the
agent is streaming a response. The spinner keeps spinning — only the
message next to it changes.

## What it does

- At the start of each agent run (each time you press enter), the
  working message becomes a random line from
  `~/.pi/agent/custom-message.txt`.
- If the run lasts longer than `rotateSeconds` (default 20s), a new
  line is picked every `rotateSeconds` for the rest of the run. Set
  `0` to lock to one line per run.
- On `agent_settled` (pi fully idle, after any auto-retries, compactions,
  or queued follow-ups), the default "Working..." text is restored.
- No two consecutive lines are the same within a run (wraps after
  exhausting the file). The used-set carries across runs within the
  same session, so you keep seeing fresh lines for the whole session.
- If the file is missing or empty, the extension is a no-op — pi's
  default "Working..." text stays.

## File format

`~/.pi/agent/custom-message.txt`:

```
# this is a comment, blank lines are ignored
Pick a card, any card.
Read the docs.
Breathe.
Write the failing test first.
The best code is the code you don't write.
```

- One message per line.
- `#` starts a comment.
- Blank lines are skipped.
- Lines longer than 2000 chars are skipped (safety cap).
- Lines are trimmed and collapsed; max 160 chars in the working message
  (truncated with `…`).

Anything you want: motivational quotes, your own reminders, a checklist,
inside jokes, a poem — pi doesn't care, it just shows one line at a time.

## Configuration

Add a `customMessage` block to `~/.pi/agent/settings.json`:

```json
{
  "customMessage": {
    "enabled": true,
    "rotateSeconds": 10,
    "filePath": "~/.pi/agent/custom-message.txt"
  }
}
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Master switch. |
| `rotateSeconds` | number (0–300) | `20` | How often to pick a new line while an agent run is in progress. `0` = one line per run. |
| `filePath` | string | `~/.pi/agent/custom-message.txt` | Path to the text file. Supports `~`. |

Invalid values are silently corrected to defaults.

The file is read once per session at `session_start`. To pick up edits,
`/reload`.

## Commands

| Command | Effect |
| --- | --- |
| `/custom` | Show current settings + line count. |
| `/custom on` / `/custom off` | Enable/disable. |

## Install

```bash
cp -r extensions/custom-message ~/.pi/agent/extensions/custom-message
```

No `npm install` needed — the only imports are the pi package
(`@earendil-works/pi-coding-agent`) and `node:fs/promises`.
