# pi-token-speed

**Copied from** [gsanhueza/pi-token-speed](https://github.com/gsanhueza/pi-token-speed)
(commit `75e0aca`, 2026-07-20). MIT, © Gabriel Sanhueza.

Real-time tokens-per-second + TTFT in the pi status bar, with a `/tps`
settings menu. See upstream for full docs, configuration options, and the
changelog.

## Layout

- `index.ts` — entry point (`export default async (pi) => { ... }`)
- `src/` — engine, events, renderer, settings, validation, etc.

## Install

```bash
cp -r extensions/pi-token-speed ~/.pi/agent/extensions/pi-token-speed
```

No `npm install` needed — the only imports are the two pi packages
(`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`), which are
already provided by pi itself, and `node:fs/promises` / `node:path`.

## Updating from upstream

```bash
# in a scratch dir
git clone --depth 1 https://github.com/gsanhueza/pi-token-speed
# re-review the diff, then copy the new index.ts + src/ over this folder
```
