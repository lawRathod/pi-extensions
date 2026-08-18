---
name: extend-updater
description: >
  Update pi extensions that were copied from external GitHub repos.
  Use when asked to update extensions, check for upstream changes,
  sync with upstream, or pull updates for copied extensions.
  Triggers: update extensions, check updates, sync upstream, pull upstream,
  extension updates, new version, upstream changes.
---

# Extension Updater

Update extensions that were copied from external GitHub repositories.
Self-written extensions (no upstream) are skipped.

## Prerequisites

- Extensions live in `extensions/` at the repo root
- Extensions with upstream sources have `upstream.json` in their directory
- The parent git repo must be clean or changes stashed before applying updates

## Quick Reference

Run the check script from the repo root:

```bash
.pi/skills/extend-updater/scripts/check-updates.sh
```

## How It Works

### 1. Discover Extensions with Upstreams

Find all extensions that have an `upstream.json`:

```bash
find extensions/ -name "upstream.json" -exec dirname {} \;
```

For each, read the JSON to get `repo`, `branch`, `commit`, and `files`.

### 2. Check for New Upstream Commits

```bash
cd extensions/<name>
git remote add upstream <repo> 2>/dev/null || true
git fetch upstream
git log --oneline <last_commit>..upstream/<branch>
```

If no commits are listed → already up to date. Report and skip.

### 3. Check for Local Modifications

Compare current files against the last synced commit:

```bash
cd extensions/<name>
git diff <last_commit> -- <files>
```

- **No diff** → no local modifications, can fast-forward
- **Has diff** → we have customizations, need careful merge

### 4. Security Review of Upstream Changes

Review what changed upstream since our last sync:

```bash
cd extensions/<name>
git diff <last_commit>..upstream/<branch> -- <files>
```

**Red flags to look for:**
- `eval`, `new Function`, `vm.runIn*`
- `child_process`, `spawn`, `exec`
- `fetch`, `http`, `https`, WebSocket (unless the extension's purpose requires it)
- File system access outside expected paths (`~/.pi/`, `ctx.cwd`, `process.env`)
- Obfuscated code, `Buffer.from(..., 'base64')`, `atob`
- Dynamic `require()` or `import()` with runtime values
- `postinstall` scripts in any new `package.json`

If any red flag is found, **stop and report**. Do not apply until reviewed.

### 5. Apply Updates

**Case A: No local modifications**
```bash
cd extensions/<name>
git checkout upstream/<branch> -- <files>
```

**Case B: Has local modifications**
Strategy: save local changes as a patch, apply upstream, re-apply local patch.

```bash
cd extensions/<name>

# Save local modifications
git diff <last_commit> -- <files> > /tmp/<name>-local.patch

# Apply upstream version
git checkout upstream/<branch> -- <files>

# Attempt to re-apply local changes
git apply --3way /tmp/<name>-local.patch
```

If `git apply` fails (conflicts):
1. Show the conflict to the user
2. Present both versions (upstream vs local)
3. Let the user decide or manually merge

### 6. Update Metadata

After successfully applying updates:

```bash
# Get the new upstream commit hash
cd extensions/<name>
NEW_COMMIT=$(git rev-parse upstream/<branch>)
```

Update `upstream.json` with the new commit hash, then commit:

```bash
cd ../..
git add extensions/<name>/
git commit -m "chore(extensions): update <name> from <old_commit> to <new_commit>"
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/check-updates.sh` | Scan all extensions, report which have updates |
| `scripts/diff-local.sh <name>` | Show local modifications for an extension |
| `scripts/diff-upstream.sh <name>` | Show upstream changes since last sync |
| `scripts/apply-update.sh <name>` | Apply upstream changes (handles patches) |

## Conflict Resolution

When `git apply --3way` fails:

1. Show `git diff` of the conflict
2. Explain what upstream changed vs what we changed
3. Options:
   - **Accept upstream** (lose our customization)
   - **Keep ours** (skip this update)
   - **Manual merge** (edit the file to combine both)
4. After resolving, update `upstream.json` commit hash

## Adding Upstream Tracking to a New Extension

If you copy a new extension from a GitHub repo:

1. Create `extensions/<name>/upstream.json`:
   ```json
   {
     "repo": "https://github.com/<owner>/<repo>.git",
     "branch": "main",
     "commit": "<commit-hash-you-copied-from>",
     "files": ["index.ts"],
     "description": "What this extension does"
   }
   ```

   **If the file was renamed** (common when copying from a monorepo), add path mapping:
   ```json
   {
     "repo": "https://github.com/<owner>/<repo>.git",
     "branch": "main",
     "commit": "<commit-hash>",
     "files": ["index.ts"],
     "upstreamPath": "extensions/tps-meter.ts",
     "localPath": "index.ts",
     "description": "What this extension does"
   }
   ```

2. Add the upstream remote:
   ```bash
   cd extensions/<name>
   git remote add upstream https://github.com/<owner>/<repo>.git
   git fetch upstream
   ```

## Full Update Workflow Example

```
$ .pi/skills/extend-updater/scripts/check-updates.sh

Scanning extensions...

pi-tps-meter:
  Upstream: https://github.com/vskrch/pi-tps-meter.git
  Last synced: e445924
  New commits: 6 (545bf3d feat: TPS meter for pi CLI, ...)
  Local modifications: YES (2 files changed)

Found 1 extension with updates available.
```

Then review, security-check, and apply as described above.
