# Extensions

One folder (or single file) per extension. Pi discovers them at load time
from `~/.pi/agent/extensions/` — copy the folder in, then `/reload`.

## Conventions

- **Naming:** `kebab-case`. The folder name is the extension name as pi sees
  it. Don't start names with `_` (it can confuse some file watchers) and
  don't reuse names from pi's built-in commands or tools.
- **Entry point:** either `<name>.ts` (single file) or `<name>/index.ts`
  (folder). Use the folder form as soon as the extension has more than one
  file, has npm dependencies, or is non-trivial.
- **Default export:** every extension's `index.ts` must
  `export default function (pi: ExtensionAPI) { ... }`. Async factories are
  fine for one-time startup work (e.g. fetching a model list).
- **No background work in the factory:** the factory may run in an invocation
  that never starts a session. Defer sockets, timers, file watchers, child
  processes to `session_start`, and clean them up in `session_shutdown`.
- **Pin dependencies:** if an extension needs npm packages, add a
  `package.json` with explicit versions. Do not commit `node_modules/` or
  `package-lock.json` (the parent `.gitignore` already excludes them).
- **No secrets in the repo.** If an extension needs an API key, read it from
  the environment at runtime (`process.env.X`), never inline it.
- **No network calls in unexpected places.** Any `fetch`, `http`, `https`,
  WebSocket, or child process should be obviously justified by the
  extension's purpose. Flag these during review.

## Layout

```
extensions/
├── simple-thing.ts                    # single-file extension
├── bigger-thing/                      # folder form
│   ├── index.ts                       # exports default function(pi)
│   ├── tools.ts                       # helper modules are fine
│   └── package.json                   # only if it has npm deps
└── with-deps/                         # folder form, has dependencies
    ├── index.ts
    ├── package.json
    └── (node_modules/ is gitignored)
```

## Security review checklist

For any extension copied from outside this repo, confirm **all** of the
below before committing. Delete the line and add a short note in the entry
table at the bottom.

- [ ] **Read every line.** No `// trust me`, no "rest is standard", no skipped
  files in `node_modules/`. If you can't read it, don't ship it.
- [ ] **No exfiltration paths.** No `fetch`/`http`/`https`/WebSocket/DNS
  calls to anything other than endpoints the extension's purpose obviously
  requires. No `child_process`/`spawn`/`exec` that isn't justified.
- [ ] **No filesystem escapes.** Writes should be scoped to paths the user
  expects (project dir, `~/.pi/`, `ctx.cwd`, an explicit user-supplied path).
  Reads of `~/.ssh/`, `~/.aws/`, `~/.gnupg/`, `~/.config/` keys, etc. are
  red flags unless the extension's whole purpose is exactly that.
- [ ] **No `eval`, `new Function`, `vm.runIn*`, dynamic `require`/`import`**
  with values from outside the extension itself.
- [ ] **No obfuscation.** No minified blobs, no `Buffer.from(...,'base64')`
  payloads, no `atob` of generated strings, no source maps that don't match.
- [ ] **Dependencies are sane.** `npm ls` shows what you expect, no
  postinstall scripts you didn't read, no install hooks that phone home.
  Prefer dependencies with no transitive `postinstall` at all.
- [ ] **Permissions are minimal.** If the extension intercepts `tool_call`
  or modifies prompts, the gating logic is obvious and the conditions are
  narrow.
- [ ] **Source known.** Either a commit hash from a repo you trust, or a
  paste you can attribute. Note it in the entry below.

When in doubt, don't add it. Bad extensions are a much worse failure mode
than missing extensions.

## Index of extensions

<!--
  Add new entries at the bottom. Format:

  - `<name>/` or `<name>.ts` — one-line purpose. Source: <url or "self">.
    Reviewed: YYYY-MM-DD.
-->

- `pi-token-speed/` — Real-time tokens-per-second + TTFT in the status bar,
  with `/tps` settings menu and a sliding-window algorithm. Status bar only —
  no `tool_call` interception, no prompt modification. Reads/writes
  `~/.pi/agent/settings.json` (the `tokenSpeed` key) for configuration.
  Source: <https://github.com/gsanhueza/pi-token-speed> (commit `75e0aca`,
  MIT). Reviewed: 2026-07-20.
- `custom-message/` — Replaces the "Working..." text with a random line from
  `~/.pi/agent/custom-message.txt` during each agent turn, with optional
  rotation. No bundled content, no API — fully driven by the user file. If
  the file is missing/empty the extension is a no-op. `/custom` command
  toggles. Self-written. Reviewed: 2026-07-20.
