# AGENTS.md

Install workflow for the pi extensions in this repo. See `README.md` and
`extensions/README.md` for everything else (purpose, layout, security
review checklist, index of current extensions).

## Copying an extension into pi

pi auto-discovers extensions from:

| Location                  | Scope              |
| ------------------------- | ------------------ |
| `~/.pi/agent/extensions/` | Global (all projects) |
| `.pi/extensions/`         | Project-local        |

Inside each, pi accepts `<name>.ts` (single file) or `<name>/index.ts`
(folder). Extensions in this repo are folder-form, so:

```bash
# From inside this repo:
cp -r extensions/<name> ~/.pi/agent/extensions/<name>
```

No `npm install` is needed. All extensions here have only the pi package
as a dependency, which pi provides itself.

In pi, run `/reload` to pick it up.

To remove:

```bash
rm -rf ~/.pi/agent/extensions/<name>
# Then /reload in pi.
```
