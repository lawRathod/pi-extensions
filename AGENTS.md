# AGENTS.md

Personal collection of [pi](https://pi.dev) extensions. **Not published.**
This file is for AI agents (and humans) who land in this repo to understand
what it is and how to do common tasks.

## What this is

- A flat collection of pi extensions under `extensions/`.
- Each extension is either self-written or copied from upstream after
  security review. See `extensions/README.md` for the review checklist.
- `extensions/README.md` has the index of what's currently in here.

## Layout

```
pi-extensions/
├── README.md                # overview, security note
├── AGENTS.md                # this file
├── .gitignore
└── extensions/
    ├── README.md            # index, conventions, review checklist
    └── <extension-name>/    # one folder per extension
        ├── index.ts         # entry point (or single <name>.ts)
        └── README.md        # stub pointing to upstream
```

## Copying an extension into pi

Extensions are auto-discovered from these locations:

| Location                  | Scope              |
| ------------------------- | ------------------ |
| `~/.pi/agent/extensions/` | Global (all projects) |
| `.pi/extensions/`         | Project-local        |

Inside each, pi accepts either `<name>.ts` (single file) or
`<name>/index.ts` (folder). The extensions in this repo are all
folder-form, so:

```bash
# From inside this repo:
cp -r extensions/<name> ~/.pi/agent/extensions/<name>
```

No `npm install` is needed for any extension in this repo. All of them
have only the pi package as a dependency, which pi provides itself.

Then in pi, run `/reload` to pick it up. The extension is now active.

To remove an extension:

```bash
rm -rf ~/.pi/agent/extensions/<name>
```

Then `/reload` in pi.

## Adding a new extension

1. Pick a kebab-case name. It becomes the folder name in
   `extensions/<name>/`.
2. Drop the source in. For folder-form: `extensions/<name>/index.ts` and
   any helper files. For a single file: `extensions/<name>.ts`.
3. If the source is from upstream, run through the security review
   checklist in `extensions/README.md`. Add an entry to the index there
   with source URL, commit hash, license, and review date.
4. If the source has a `package.json` for pi's install workflow, drop
   it. peerDeps are already satisfied by pi itself. Also drop LICENSE
   files (MIT attribution goes in the stub README).
5. If the upstream entry point isn't `index.ts` (e.g. `tps-meter.ts`),
   rename it to `index.ts` for folder-form auto-discovery.
6. Write a short stub README pointing to upstream.
7. Commit and push.

## Updating an extension from upstream

For a folder-form extension copied from upstream:

```bash
# In a scratch dir:
git clone --depth 1 <upstream-url>
# Re-review the diff against the version in extensions/<name>/.
# Then copy over the source files. For pi-tps-meter, this is:
cp <scratch>/extensions/tps-meter.ts extensions/<name>/index.ts
```

Update the "Source" line in `extensions/<name>/README.md` with the new
commit hash and date. Update the entry in `extensions/README.md` too.

Then reinstall locally:

```bash
cp -r extensions/<name> ~/.pi/agent/extensions/<name>
# In pi:
/reload
```

## When working in this repo

- **No publishing.** Don't add CI, npm publish configs, release scripts,
  or anything that suggests this will be released. It won't be.
- **Don't reformat copied code.** Keep the source as close to upstream
  as possible so future diffs are obvious.
- **Don't add dependencies.** If an extension needs an npm package, drop
  it or pick a different extension.
- **Prefer folder-form for any non-trivial extension.** Single-file
  form is only OK for tiny utilities.
- **Check `extensions/README.md` for conventions** before adding
  anything — naming, file layout, the security review checklist, and
  the entry format.
