# fun-facts

Replaces pi's "Working..." text with a random fun fact while the agent is
streaming a response. The spinner keeps spinning — only the message next
to it changes.

## What it does

- On each LLM turn, the working message becomes a random fact.
- A new fact is picked every 10s during long turns (configurable, 0 = one
  per turn).
- On `turn_end` / `agent_settled`, the default "Working..." text is
  restored.
- No two consecutive facts are the same within a turn.

## Sources

| Source | How |
| --- | --- |
| **Bundled** (default) | ~50 curated facts in `facts.ts`. Always available, no network. |
| **User file** | `~/.pi/agent/fun-facts.txt` — one fact per line, `#` starts a comment. Appended to the bundled pool. |
| **API** | `https://uselessfacts.jsph.pl/api/v2/facts/random?language=en` (free, no auth). Falls back to the local pool on timeout or error. |

## Configuration

Add a `funFacts` block to `~/.pi/agent/settings.json`:

```json
{
  "funFacts": {
    "enabled": true,
    "rotateSeconds": 10,
    "useApi": false
  }
}
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Master switch. |
| `rotateSeconds` | number (0–300) | `10` | How often to pick a new fact during a turn. `0` = one fact per turn. |
| `useApi` | boolean | `false` | When `true`, fetch from the API first and fall back to the local pool on failure. |

Invalid values are silently corrected to defaults.

## Commands

| Command | Effect |
| --- | --- |
| `/facts` | Show current settings. |
| `/facts on` / `/facts off` | Enable/disable. |
| `/facts api on` / `/facts api off` | Toggle the API source. |

## Install

```bash
cp -r extensions/fun-facts ~/.pi/agent/extensions/fun-facts
```

No `npm install` needed — the only imports are the pi package
(`@earendil-works/pi-coding-agent`) and `node:fs/promises` / `node:path`.
