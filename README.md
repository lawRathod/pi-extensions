# pi-extensions

Personal collection of [pi](https://github.com/badlogic/pi) extensions.

These are **not published**. Each extension lives here either because I wrote it
or because I copied it from elsewhere after a security review. If you want to
use one, copy the file/folder into your own `~/.pi/agent/extensions/` (or
`.pi/extensions/` for project-local) however you like.

## Layout

```
pi-extensions/
├── README.md               # you are here
├── .gitignore
└── extensions/             # one entry per extension
    ├── README.md           # naming conventions, install, review checklist
    └── <extension-name>/
        ├── index.ts        # entry point (or single <name>.ts)
        ├── package.json    # only if it has npm deps
        └── ...
```

See [`extensions/README.md`](./extensions/README.md) for the conventions each
extension should follow, how to install one into pi, and the security review
checklist applied to anything copied from outside.

## Security

> **Extensions run with your full system permissions.** They can execute
> arbitrary code, read every file your user can read, and exfiltrate anything.
> Only use extensions you have read end-to-end, or that you trust the author
> of, completely.

Every extension in this repo — mine or someone else's — is meant to have been
read line by line before it lands here. Anything copied from the wider pi
ecosystem, GitHub gists, blog posts, Discord snippets, etc. must clear the
checklist in `extensions/README.md` first.

## Adding an extension

1. Decide the name (kebab-case, see `extensions/README.md`).
2. Drop the source under `extensions/<name>/`.
3. If it has npm dependencies, add a local `package.json` (do **not** commit
   `node_modules/` or `package-lock.json`).
4. Update `extensions/README.md` with a one-line description, source, and
   review date if it came from elsewhere.
5. Commit.

## Installing an extension into pi

pi auto-loads from these locations:

| Location                     | Scope              |
| ---------------------------- | ------------------ |
| `~/.pi/agent/extensions/`    | Global (all projects) |
| `.pi/extensions/`            | Project-local        |

Inside each, pi accepts either `<name>.ts` or `<name>/index.ts`.

So to install `extensions/foo/index.ts` globally:

```bash
cp -r extensions/foo ~/.pi/agent/extensions/foo
```

For extensions with npm deps:

```bash
cp -r extensions/foo ~/.pi/agent/extensions/foo
cd ~/.pi/agent/extensions/foo
npm install
```

For a quick one-off test without copying anything:

```bash
pi -e /path/to/pi-extensions/extensions/foo/index.ts
```

Inside pi, `/reload` picks up newly added extensions. If you only edited an
existing one, `/reload` hot-reloads it.
