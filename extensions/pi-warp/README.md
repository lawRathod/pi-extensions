# pi-warp

**Copied from** [TeahouseHQ/pi-warp](https://github.com/TeahouseHQ/pi-warp)
(commit `d2790d4`, v1.0.1, 2026-05-16). MIT, © Yi-An Lai / TeahouseHQ.

Real-time pi notifications in the [Warp](https://www.warp.dev/) terminal:

- **Session tracking** — Warp knows when pi starts/stops a session.
- **Prompt notifications** — inline notification when the agent starts working.
- **Completion signal** — notification when the agent finishes.
- **Permission notifications** — when the `tool-permissions` extension blocks
  a tool (deny rule, ask prompt on screen, ask without UI), pi-warp raises a
  `permission_request` notification in Warp so you're pinged even when
  you're looking at another tab.
- **Animated terminal title** — optional braille spinner while busy.

The extension detects Warp via `WARP_CLI_AGENT_PROTOCOL_VERSION` /
`WARP_CLIENT_VERSION` and silently disables itself outside Warp or on
incompatible builds. `/pi-warp-settings` toggles dynamic terminal titles
(persisted in `~/.pi/agent/settings.json` under `piWarp`).

## Layout

- `index.ts` — entry point; hooks `before_agent_start`, `agent_end`,
  `session_start`, `tool_execution_end` and emits OSC sequences.
- `src/payload.ts` — protocol version negotiation + base payload builder.
- `src/osc.ts` — OSC 777 notify emitter (writes to `/dev/tty`).
- `src/title.ts` — OSC 0 terminal-title spinner (braille frames).
- `src/events.ts` — payload builders for each event.
- `src/settings.ts` — settings read/write in pi's global `settings.json`.
- `src/version.ts` — Warp build detection / broken-version thresholds.

## Install

```bash
cp -r extensions/pi-warp ~/.pi/agent/extensions/pi-warp
```

No `npm install` needed — runtime imports are only the pi-provided peer
packages (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`) plus
`node:` builtins.

## Updating from upstream

```bash
# in a scratch dir
git clone https://github.com/TeahouseHQ/pi-warp
# re-review the diff, then copy index.ts + src/ over
```

## Differences from upstream

- `package.json` trimmed to what runtime needs (name/version/type — `index.ts`
  reads `pkg.version` and uses `import.meta.url`, so `type: "module"` must
  stay). Upstream's `devDependencies` (eslint/typescript/vitest) dropped.
- `tests/`, `tsconfig.json`, `eslint.config.js`, `.github/`, `static/`,
  `AGENT.md`, and the `src/types/pi-coding-agent.d.ts` type stub dropped
  (developer harness only — not loaded at runtime).
- **Hook 5 wired.** Upstream left `permission_request` unconnected
  ("DISABLED — not wired to tool_call"). Here it listens for the
  `pi-warp:blocked` bus event emitted by this repo's `tool-permissions`
  extension (`{ active, toolName, input, reason }`) and sends the payload
  built by the (upstream-shipped, previously dead) `buildPermissionRequestPayload`.
  `active=false` is ignored (no resolve notification in the protocol yet).
- **Handler types adapted to real pi types.** Upstream compiled against its
  own loose local stub (`src/types/pi-coding-agent.d.ts`, dropped here). The
  handlers now use pi's real exported event types; `agent_end` messages are
  cast since real `AgentMessage` content includes image/thinking/toolCall
  parts the `buildStopPayload` filters out at runtime. Typechecks clean
  against `@earendil-works/pi-coding-agent` 0.84.x.
- `sessionCtx` cached in `session_start` so the bus handler can build
  payloads (bus events carry no ctx).
- `sanitizeInput()` bounds each string field of tool input to 200 chars in
  the OSC payload — write/edit inputs can carry large content that would
  bloat the escape sequence past terminal buffer limits.
- License file preserved for MIT attribution.

## Security review (2026-08-04)

Cleared the checklist in `extensions/README.md`:

- **I/O is minimal and local.** Only writes are OSC escape sequences to
  `/dev/tty` (the extension's whole purpose — Warp's notification protocol)
  and one key in `~/.pi/agent/settings.json` (only via the explicit
  `/pi-warp-settings` command). Reads: own `package.json` and pi's settings.
- **No network.** Zero `fetch`/`http`/`https`/WebSocket/DNS calls.
- **No `child_process`, no `eval`/`new Function`/`vm`, no dynamic require.**
- **No obfuscation** — plain readable source, matches upstream commit.
- **Permissions minimal.** No `tool_call` interception, no prompt/system
  modification. All hooks are read-only observers that emit notifications.
  One command (`/pi-warp-settings`) that only toggles its own setting.
- **Dependencies sane.** Runtime deps are pi-provided peer deps; the only
  install-script packages in upstream's lockfile are dev-only transitive
  deps of vitest, not shipped here.
- **Payload note:** truncated prompt/response (200 chars each), cwd, project
  name, and session file path go to the local terminal as OSC 777 — local
  only, viewable in that terminal session. This is the feature, not a leak.
- **Integration note:** the `pi-warp:blocked` contract is with this repo's
  `tool-permissions` extension (emitter) — this copy of pi-warp is the
  listener. If upstream ever wires `permission_request` itself, drop Hook 5.
