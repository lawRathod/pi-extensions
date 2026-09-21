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

- `pi-tps-meter/` — Live tokens-per-second meter for the status bar with a
  sub-cell gauge during streaming and a 12-message sparkline + avg/μ/p95
  after each message. Status bar only — no `tool_call` interception, no
  prompt modification. No file or network I/O. Source:
  <https://github.com/vskrch/pi-tps-meter> (commit `e445924`, MIT).
  Reviewed: 2026-07-20.
- `custom-message/` — Replaces the "Working..." text with a random line from
  `~/.pi/agent/custom-message.txt` during each agent turn, with optional
  rotation. No bundled content, no API — fully driven by the user file. If
  the file is missing/empty the extension is a no-op. `/custom` command
  toggles. Self-written. Reviewed: 2026-07-20.
- `pi-grid-footer/` — Replaces the built-in footer with a 2×2 layout: pwd
  (top-left), model (top-right), `tps` extension status (bottom-left), token
  stats (bottom-right). Other extension statuses fall through to a 3rd line.
  No `tool_call` interception, no prompt modification, no file or network
  I/O. Self-written. Reviewed: 2026-07-20.
- `tool-permissions/` — Per-tool allow/ask/deny rules from project
  `.pi/permission.json`, enforced via `tool_call` interception (blocks or
  prompts; never grants). While an ask prompt is open, emits `herdr:blocked`
  so the herdr integration reports pi as blocked (needs-input
  toast/sound); also emits `pi-warp:blocked` so the pi-warp extension can
  raise a Warp notification for every block (deny, no-UI ask, ask prompt
  on screen). Reads one small JSON per tool call — no network I/O, no
  other file access. Self-written. Reviewed: 2026-08-04.
- `pi-warp/` — Real-time pi notifications in the Warp terminal via OSC 777
  (session start, prompt submitted, agent done, tool complete,
  permission-request when `tool-permissions` blocks a tool) plus an
  optional animated braille spinner in the terminal title. Writes only OSC
  sequences to `/dev/tty` and one key in `~/.pi/agent/settings.json` (via
  `/pi-warp-settings`). No network, no `child_process`, no `tool_call`
  interception (listens for the `pi-warp:blocked` bus event instead).
  Source: <https://github.com/TeahouseHQ/pi-warp> (commit `d2790d4`, v1.0.1,
  MIT). Reviewed: 2026-08-04.
- `pi-commandcode-provider/` — Custom provider for the Command Code API
  (commandcode.ai). Registers models, handles OAuth authentication,
  forwards requests to Command Code's generate endpoint. Network calls
  scoped to `api.commandcode.ai`. File writes scoped to
  `~/.pi/agent/commandcode-models.json` (model cache). Source:
  <https://github.com/patlux/pi-commandcode-provider> (commit `c4d25d1`,
  v0.5.1, MIT). Reviewed: 2026-08-18.
- `pi-guardrails/` — Safety checks for pi: file protection policies
  (`guardrails`), outside-workspace path access gate (`path-access`),
  dangerous-command gate (`permission-gate`), and Herdr adapter
  (`herdr`). Four extensions in one package; config via
  `/guardrails:settings` / `/guardrails:onboarding`. Runtime deps
  `@aliou/pi-utils-settings` + `@aliou/sh`; only `execFile("fd")` for
  glob expansion. Source: <https://github.com/aliou/pi-guardrails>
  (commit `a3da058`, v0.17.0, MIT). Reviewed: 2026-08-18.
- `rpiv-todo/` — Live todo overlay for the model: `todo` tool,
  `/todos` command, and persistent panel above the editor surviving
  `/reload` and compaction. Session-isolated, dependency-aware
  (`blockedBy` cycle-checked). No network, no disk writes (state
  replayed from branch). Source:
  <https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-todo>
  (commit `c6e15db`, v2.6.2, MIT, monorepo path
  `packages/rpiv-todo` → `rpiv-todo/`). Reviewed: 2026-08-19.
- `rpiv-ask-user-question/` — Structured questionnaire tool
  (`ask_user_question`): 1-4 tabbed questions with 2-4 typed options
  each, required option descriptions, optional markdown `preview` pane,
  per-question and global notes, Submit review tab, fuzzy-free keyboard
  flow, RPC/ACP `select`/`input` dialog fallback, and config-file
  overrides for tool description / `promptSnippet` / `promptGuidelines`.
  Mandatory security review passed 2026-09-14: **no network calls of any
  kind**, no `eval`/`new Function`/`vm`, no obfuscation. Only `node:fs`
  write is a `mkdtempSync` temp file under `$TMPDIR` for the `Ctrl+G`
  external editor (removed in `finally`); `node:child_process` `spawn`
  runs only the editor command Pi itself resolves via
  `SettingsManager.getExternalEditorCommand()`, with the same
  `command.split(" ")` grammar as Pi's own editor flow. Config reads are
  scoped to `$XDG_CONFIG_HOME/rpiv-ask-user-question/config.json`
  (read-only, never written by this package). The only tool-list
  mutation is an idempotent add/remove of its own `ask_user_question`
  gated on `ctx.hasUI`. Dependencies: `@juicesharp/rpiv-config`
  (local-path shared util, read-only config I/O) and `typebox`; optional
  peer `@juicesharp/rpiv-i18n` (dynamic import, English fallback when
  absent); no postinstall hooks. `docs/*.png|jpg|svg` and the test suite
  are excluded from this copy. Source:
  <https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-ask-user-question>
  (commit `0fdf4f8`, v2.10.1, MIT, monorepo path
  `packages/rpiv-ask-user-question` → `rpiv-ask-user-question/`).
  Reviewed: 2026-09-14.
- `pi-web-access/` — Web search, URL fetching, GitHub repo cloning, PDF extraction,
  YouTube video understanding, and local video analysis. Tools:
  `web_search`, `fetch_content`, `get_search_content`, `source_check`;
  commands: `/websearch`, `/curator`, `/search`, `/google-account`.
  Search providers: OpenAI, Brave, Parallel, TinyFish, Search1API,
  Searchinfinity, Querit, Tavily, Firecrawl, Jina, SERPdive, Kagi, Bocha,
  Ollama, AnySearch, Valyu, xAI, Bright Data, SerpBase, Serper, SearXNG,
  DuckDuckGo, Exa, Perplexity, Gemini. SSRF-gated fetch with domain
  policy, private-range blocking, chunked 5 MB streaming, and optional
  browser-cookie auth (opt-in). File writes scoped to
  `~/.pi/web-search.json` + `web-search-cache/` (0700/0600) and the
  configured GitHub clone/cache dirs. Network calls limited to the
  configured search/fetch provider endpoints and (when enabled) Chrome
  cookie decryption + Gemini/video APIs. Deps: `@mozilla/readability`,
  `linkedom`, `p-limit`, `turndown`, `typebox`, `unpdf`, `undici`
  (no postinstall). No `eval`/`vm`, no obfuscation, no prompt
  interception. Source: <https://github.com/nicobailon/pi-web-access>
  (commit `1584928`, v0.24.0, MIT). Reviewed: 2026-08-21.
- `pi-mcp-adapter/` — MCP adapter for Pi: single `mcp` proxy tool
  (~200 tokens) replaces verbose per-server definitions, lazy server
  start with metadata caching, on-demand browser OAuth (`/mcp`,
  `/mcp-auth`), stdio/HTTP/Unix-socket transports, bundled `mcpScript`
  worker (isolated `vm` context) and `mcp-scripting` skill. No
  exfiltration beyond the MCP servers you configure; `child_process`
  (`spawn`/`spawnSync`) and OAuth callback only for those servers;
  `vm` (codeGeneration: no strings/wasm) plus `fetch`/WebSocket only
  through `@modelcontextprotocol/client`. Source:
  <https://github.com/nicobailon/pi-mcp-adapter> (commit `a3072f6`,
  v2.27.0, MIT). Reviewed: 2026-08-21.
- `pi-subagents-lite/` — Sub-agents for pi: spawn custom agents in
  isolated sessions with own tools, extensions, and model. Three
  tools (`Agent`, `StopAgent`, `AgentStatus`) with minimal token
  overhead, no descriptions. Foreground and background agents,
  concurrency limits, watchdog for stuck agents, cross-repo worktree
  support, custom agent types via `.md` files, and a live widget
  above the editor with conversation viewer. No exfiltration, no
  eval, no obfuscation. Dependencies: `@sinclair/typebox`. Source:
  <https://github.com/AlexParamonov/pi-subagents-lite> (commit
  `e35a49d`, v1.13.0, MIT). Reviewed: 2026-08-27.
- `pi-neuralwatt/` — Neuralwatt model provider for pi. OpenAI-compatible
  API with energy transparency, quota tracking (credits + energy),
  rate-limit error rewriting (layer-specific headers), live SSE quota
  comments, and quota warnings. Sub-bar integration shows live usage.
  Network calls scoped to `api.neuralwatt.com`. No eval, no
  `child_process`, no filesystem writes outside pi's auth/credential
  storage. Dependencies: `@aliou/pi-utils-settings`,
  `@aliou/pi-utils-ui`. Source:
  <https://github.com/aliou/pi-neuralwatt> (commit `66472af`, v0.15.2,
  MIT). Reviewed: 2026-09-07.
- `ponytail/` — Lazy senior dev mode for pi. Injects a YAGNI ruleset
  (lite/full/ultra) into every prompt, plus skill routes for
  review/audit/debt/gain/help. No exfiltration, no eval, no network.
  Filesystem writes scoped to `~/.config/ponytail/` (config) and
  Claude/Codex plugin state dirs (mode flag). Source:
  <https://github.com/DietrichGebert/ponytail> (commit `356918e`, MIT).
  Reviewed: 2026-09-07.
- `pi-goal/` — Persistent autonomous goals for pi: `/goal [--tokens 50k]
  <objective>` plus `create_goal`/`get_goal`/`update_goal` tools (the latter
  two exposed only while a goal is active). Persists goal state as pi
  session entries, continues the same session until complete/paused/
  cleared/budget-limited, and ships the `pi-goal-writer` skill. No
  exfiltration, no `child_process`, no filesystem writes (state lives in
  the session), no eval. Local patches: imports retargeted
  `@mariozechner/*` → `@earendil-works/*`, an empty status is cleared
  with `undefined` instead of `""` so the footer status row stays empty,
  and an escape-aborted turn pauses the goal instead of letting
  `agent_end` queue another continuation (ported from the unmerged
  upstream branch `fix/pause-on-escape`; guarded by
  `test/abort-pauses.test.cjs`).
  Source: <https://github.com/Michaelliv/pi-goal> (commit `3f100be`,
  v0.1.7, MIT). Reviewed: 2026-09-19.
- `pi-btw/` — Parallel side conversations via `/btw` in a real pi
  sub-session (its own `read`/`bash`/`edit`/`write` tools), with a
  focused overlay, thread state persisted as hidden session entries,
  BTW-only model/thinking overrides, and `/btw:inject` /`/btw:summarize`
  handoff back to the main agent. Ships the `btw` skill (in-folder
  `skills/btw/`, loaded when installed as a pi package) and the upstream
  README + overlay screenshot. **No network calls of any kind**, no
  `eval`/`new Function`/`vm`, no `child_process`, no filesystem I/O —
  sub-sessions are in-memory (`SessionManager.inMemory()`) and built
  from `ctx.sessionManager` + `ctx.modelRegistry`. Only env read is
  `PI_BTW_FOCUS_KEYS` (shortcut remap). Sole `plugin`-wide hooks:
  `context` (strips its own BTW notes from main-session messages) and
  `tool_call` is never intercepted. No `setStatus`, so no pi-grid-footer
  change needed. Upstream test suite (91 tests, vitest) passes at this
  commit; tests are not copied here. Source:
  <https://github.com/dbachelder/pi-btw> (commit `1b599b2`, v0.5.0, MIT).
  Reviewed: 2026-09-21.
