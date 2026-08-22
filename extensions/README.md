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
- `pi-ask-user/` — Interactive `ask_user` tool for collecting user
  decisions during an agent run: searchable single/multi-select with
  split-pane preview, freeform input, optional comment, overlay/inline
  modes, and bundled `ask-user` decision-gating skill. Emits
  `herdr:blocked` while waiting for input. No network, no filesystem
  writes, no `child_process`. Source:
  <https://github.com/edlsh/pi-ask-user> (commit `2de7e14`, v0.14.0,
  MIT). Reviewed: 2026-08-21.
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
