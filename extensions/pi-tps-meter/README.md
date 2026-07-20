# pi-tps-meter

**Copied from** [vskrch/pi-tps-meter](https://github.com/vskrch/pi-tps-meter)
(commit `e445924`, v3.0.4, 2026-07-20). MIT, © Venkata Sai Chirasani.

Live tokens-per-second meter for the pi status bar. During streaming it
shows a sub-cell gauge (`⠹ ▕███████▋···▏ 47 tps`); after each message it
shows a 12-message sparkline plus rolling avg / mean / p95 stats.

See upstream for full docs and the changelog.

## Layout

- `index.ts` — entry point (`export default function tpsMeter(pi)`). Renamed
  from upstream's `tps-meter.ts` so pi's auto-discovery picks it up as a
  folder-form extension.

## Install

```bash
cp -r extensions/pi-tps-meter ~/.pi/agent/extensions/pi-tps-meter
```

No `npm install` needed — the only import is the type-only
`ExtensionAPI` from `@earendil-works/pi-coding-agent`.

## Updating from upstream

```bash
# in a scratch dir
git clone --depth 1 https://github.com/vskrch/pi-tps-meter
# re-review the diff, then copy the new extensions/tps-meter.ts over as index.ts
```

## Differences from upstream

- File renamed `tps-meter.ts` → `index.ts` for folder-form auto-discovery.
- `package.json`, `LICENSE`, `tps-sim.test.ts`, and `.gitignore` dropped
  (peerDeps are already satisfied by pi; the test file is a developer
  harness not loaded at runtime; MIT attribution preserved here).
