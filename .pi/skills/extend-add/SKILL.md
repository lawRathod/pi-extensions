---
name: extend-add
description: >
  Add a new extension to this repo from an external source.
  Use when asked to add an extension, copy an extension, import an extension,
  or set up a new extension. Runs security review, copies files, sets up
  upstream tracking, and updates the README.
  Triggers: add extension, copy extension, import extension, new extension,
  install extension, add upstream.
---

# Extension Adder

Add extensions from external GitHub repos to this repo with security review
and upstream tracking.

## Prerequisites

- Extension source is a GitHub repo or URL
- User has reviewed the extension and wants to add it

## Workflow

### 1. Clone and Inspect

```bash
cd /tmp && rm -rf <repo-name>
git clone --depth 1 <repo-url> <repo-name>
cd <repo-name>
git log --oneline -1          # get commit hash
cat README.md                 # understand what it does
cat package.json              # check dependencies
ls -la src/                   # see structure
```

### 2. Security Review (MANDATORY)

Go through every item. If any fails, **stop and report**.

#### Checklist

- [ ] **Read every line.** No `// trust me`, no "rest is standard", no skipped files in `node_modules/`. If you can't read it, don't ship it.
- [ ] **No exfiltration paths.** No `fetch`/`http`/`https`/WebSocket/DNS calls to anything other than endpoints the extension's purpose obviously requires. No `child_process`/`spawn`/`exec` that isn't justified.
- [ ] **No filesystem escapes.** Writes should be scoped to paths the user expects (project dir, `~/.pi/`, `ctx.cwd`, an explicit user-supplied path). Reads of `~/.ssh/`, `~/.aws/`, `~/.gnupg/`, `~/.config/` keys, etc. are red flags unless the extension's whole purpose is exactly that.
- [ ] **No `eval`, `new Function`, `vm.runIn*`, dynamic `require`/`import`** with values from outside the extension itself.
- [ ] **No obfuscation.** No minified blobs, no `Buffer.from(...,'base64')` payloads, no `atob` of generated strings, no source maps that don't match.
- [ ] **Dependencies are sane.** `npm ls` shows what you expect, no postinstall scripts you didn't read, no install hooks that phone home.
- [ ] **Permissions are minimal.** If the extension intercepts `tool_call` or modifies prompts, the gating logic is obvious and the conditions are narrow.
- [ ] **Source known.** Either a commit hash from a repo you trust, or a paste you can attribute.

#### Quick security scan commands

```bash
# Dangerous patterns
grep -rn "eval\|new Function\|vm\.runIn\|child_process\|spawn\|exec(" src/ index.ts

# Network calls (check if justified)
grep -rn "fetch\|http\|https\|WebSocket\|DNS" src/ index.ts

# File system access (check scope)
grep -rn "readFile\|writeFile\|mkdir\|rm\|cp\|mv" src/ index.ts

# Obfuscation
grep -rn "Buffer\.from\|atob\|btoa\|base64" src/ index.ts

# Dynamic imports
grep -rn "require(\|import(" src/ index.ts
```

### 2b. Footer / Status Integration Check

Determine whether the extension renders anything in the TUI footer/status
area. If it does, pi-grid-footer (our custom footer) must be updated to
incorporate it — otherwise the new status is invisible (setStatus is
fire-and-forget and custom footers don't repaint on it).

```bash
# Footer/status usage
grep -rn "setStatus\|setFooter\|setWidget\|setTitle\|requestRender\|getExtensionStatuses" src/ index.ts

# Shared event bus publications (extensions that need live repaints)
grep -rn "pi\.events\|events\.emit\|status/v1" src/ index.ts
```

If the extension sets any footer status:

- [ ] Identify the status key(s) it uses (e.g. `setStatus("tps", ...)`).
- [ ] Decide placement in `extensions/pi-grid-footer/index.ts`:
  - Prominent/always-on status → give it its own cell (like MCP did).
  - Occasional status → it already appears on row 3 (the "other statuses"
    line) via `getExtensionStatuses()`; verify the key isn't filtered out.
- [ ] Check if it needs **live repaints while pi is idle** (e.g. connecting
  progress, timers). If so, subscribe to its event bus (if it publishes one)
  or otherwise trigger `tui.requestRender()` — `setStatus` alone won't
  repaint a custom footer.
- [ ] Update `extensions/pi-grid-footer/README.md` (layout diagram + caveats).
- [ ] Sync the updated footer to `~/.pi/agent/extensions/pi-grid-footer/`.
- [ ] Note the footer integration in the commit message.

> Only applies to extensions that touch the footer. Skip if the grep comes
> back empty.

### 3. Copy to extensions/

Determine the extension name (kebab-case, folder form preferred):

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"

# For folder extensions (preferred):
mkdir -p "$REPO_ROOT/extensions/<name>"
cp index.ts src/ "$REPO_ROOT/extensions/<name>/"

# For single-file extensions:
cp index.ts "$REPO_ROOT/extensions/<name>.ts"
```

### 4. Set Upstream Tracking

If the extension is from an external repo, create `upstream.json`:

```bash
COMMIT=$(git rev-parse HEAD)

cat > "$REPO_ROOT/extensions/<name>/upstream.json" << EOF
{
  "repo": "<repo-url>",
  "branch": "main",
  "commit": "$COMMIT",
  "files": ["index.ts"],
  "description": "<one-line description>"
}
EOF
```

**If files were renamed** (e.g., monorepo path), add path mapping:

```json
{
  "repo": "<repo-url>",
  "branch": "main",
  "commit": "<hash>",
  "files": ["index.ts"],
  "upstreamPath": "extensions/tps-meter.ts",
  "localPath": "index.ts",
  "description": "What this extension does"
}
```

Add the upstream remote:

```bash
cd "$REPO_ROOT/extensions/<name>"
git init
git remote add upstream <repo-url>
git fetch upstream
```

### 5. Update README.md

Add an entry to the index table at the bottom of `extensions/README.md`:

```markdown
- `<name>/` — One-line purpose. Source: <url>. Reviewed: YYYY-MM-DD.
```

### 6. Commit

```bash
cd "$REPO_ROOT"
git add extensions/<name>/
git add extensions/README.md
git commit -m "feat(extensions): add <name> from <source>

- Security review passed
- Upstream tracking configured (commit <hash>)
- <any customizations note>"
```

### 7. Clean Up

```bash
rm -rf /tmp/<repo-name>
```

## Path Mapping Examples

When the source repo has a different structure:

| Source Path | Local Path | upstreamPath | localPath |
|-------------|------------|--------------|-----------|
| `extensions/tps-meter.ts` | `index.ts` | `extensions/tps-meter.ts` | `index.ts` |
| `src/index.ts` | `index.ts` | `src/index.ts` | `index.ts` |
| `packages/foo/extension.ts` | `index.ts` | `packages/foo/extension.ts` | `index.ts` |

## Full Example

```
$ User: "Add git@github.com:user/my-extension.git"

1. Cloned to /tmp/my-extension
2. Security review: PASSED
   - No eval, no child_process, no obfuscation
   - fetch calls are for the extension's API (justified)
   - File writes scoped to ~/.pi/
3. Copied to extensions/my-extension/
4. Upstream tracking: commit abc1234
5. README updated
6. Committed: feat(extensions): add my-extension from github.com/user/my-extension
```
