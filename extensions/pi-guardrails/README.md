# pi-guardrails

**Copied from** [aliou/pi-guardrails](https://github.com/aliou/pi-guardrails)
(commit `a3da058`, v0.17.0, 2026-08-18). MIT.

Safety checks for pi — four extensions in one package that make the agent
less likely to read secrets, escape the workspace, or run dangerous shell
commands by accident.

| Extension | What it does |
|---|---|
| `guardrails` | File protection policies, `/guardrails:settings`, `/guardrails:onboarding`, `/guardrails:examples` |
| `path-access` | Ask/block/allow for tool calls that target paths outside the current workspace (`cwd`) |
| `permission-gate` | Detects dangerous bash commands before they run (rm -rf, sudo, dd, mkfs, chmod 777, docker --privileged, etc.) |
| `herdr` | Reports active Guardrails approval prompts via `herdr:blocked` so Herdr can show the pane as blocked |

See upstream [README.md](./README.upstream.md) for full docs, demos, and
configuration reference.

## Layout

```
pi-guardrails/
├── package.json          # pi manifest (4 extensions) + runtime deps
├── schema.json           # JSON Schema for settings autocomplete
├── upstream.json         # source pin for `extend-updater`
├── README.md             # this file
├── README.upstream.md    # upstream README (verbatim)
├── src/
│   ├── core/             # check, dangerous commands, path plausibility, shell AST
│   └── shared/           # config loader/migrations, glob, matching, bash-path extraction, events
└── extensions/
    ├── guardrails/       # policies + commands/components
    ├── path-access/      # outside-workspace gate
    ├── permission-gate/  # dangerous-command gate
    └── herdr/            # Herdr adapter
```

## Install

```bash
# from this repo:
cp -r extensions/pi-guardrails ~/.pi/agent/extensions/pi-guardrails
cd ~/.pi/agent/extensions/pi-guardrails
npm install --omit=dev --ignore-scripts   # runtime only: @aliou/pi-utils-settings + @aliou/sh
# then in pi:
/reload
/guardrails:onboarding   # first-run setup
```

> **Why `npm audit` shows 5 highs if you run plain `npm install`:** upstream's
> `package.json` ships `devDependencies` (not needed at runtime) that pull an
> older `pi-coding-agent@0.79.6` with old `brace-expansion`/`protobufjs`/
> `undici`/`ws`. Those are never loaded at runtime — pi provides those peers
> itself. `npm install --omit=dev` (what `pi install` does) has
> **0 vulnerabilities** (`npm audit` → `found 0`). `pnpm install --prod`
> equivalent. Don't `npm audit fix --force` — it would try to bump pi itself.

Runtime imports are only the pi-provided peers
(`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`) plus the two
runtime deps above; everything else is `node:` builtins.

Configuration (via `/guardrails:settings` or by editing the JSON file):

- Global: `~/.pi/agent/extensions/guardrails.json`
- Project: `.pi/extensions/guardrails.json`

## Updating from upstream

```bash
# in a scratch dir
git clone https://github.com/aliou/pi-guardrails
# re-review the diff, then copy package.json, schema.json, src/, extensions/ over
# keep upstream.json commit in sync
```

## Differences from upstream

- `*.test.ts`, `__mocks__/`, `tests/`, `biome.json`, `CHANGELOG.md`,
  `AGENTS.md`, `shell.nix`, and dev-only `pnpm-lock.yaml` dropped
  (developer harness only — not loaded at runtime).
- `package.json` `devDependencies`/`scripts`/`packageManager` retained for
  reference but not needed at runtime; only `dependencies` + `pi.extensions`
  matter after `npm install`.
- Upstream `README.md` preserved as `README.upstream.md`; this file is the
  local install/attribution wrapper.

## Security review (2026-08-18)

Cleared the checklist in `extensions/README.md`:

- **Read every line.** ~7.8k LOC non-test across `src/` + `extensions/`
  (90 files, 11.7k LOC including tests). No skipped files, no `node_modules`
  blobs.
- **No exfiltration paths.** Zero `fetch`/`http`/`https`/WebSocket/DNS calls.
  Only `child_process` is `execFile("fd", ...)` in `src/shared/glob.ts` to
  expand shell globs (e.g. `.env*`) via `fd` (`~/.pi/agent/bin/fd`, in pi's
  PATH) — narrow, justified, bounded (`--max-depth 3`, `--max-results 50`,
  2s timeout + kill). No other `spawn`/`exec`.
- **No filesystem escapes.** Writes are scoped to pi's settings files via
  `@aliou/pi-utils-settings` (`~/.pi/agent/extensions/guardrails.json` /
  `.pi/extensions/guardrails.json`); no reads of `~/.ssh/`, `~/.aws/`,
  `~/.gnupg/` etc. except as *targets* blocked by policy (the point of the
  extension). Path-access grants stored as explicit `{ kind, path }` entries.
- **No `eval`/`new Function`/`vm.runIn*`/dynamic `require`/`import`.**
- **No obfuscation.** Plain TypeScript, no `Buffer.from`/`atob`/`base64`
  payloads, no minified blobs.
- **Dependencies sane.** Two runtime deps (`@aliou/pi-utils-settings@0.19.1`,
  `@aliou/sh@0.2.2`), both by the same author, no postinstall scripts
  (`pnpm install --frozen-lockfile --ignore-scripts` in upstream). Peers are
  pi-provided.
- **Permissions minimal.** Each extension only intercepts the `tool_call` it
  owns (`guardrails` → file tools, `path-access` → outside-cwd paths,
  `permission-gate` → `bash`), checks against compiled policies/patterns, and
  either allows, blocks, or prompts. Prompt lifecycle events
  (`guardrails:prompt:opened/closed`) and `guardrails:action:blocked` are
  emitted on pi's bus for Herdr/warp-style integrations. No prompt
  modification beyond blocking.
- **Source known.** Commit `a3da058` on `main` of
  `https://github.com/aliou/pi-guardrails` (tag `v0.17.0`).
