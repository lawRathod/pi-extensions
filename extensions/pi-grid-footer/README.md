# pi-grid-footer

Replaces pi's built-in footer with a 2×2 layout:

```
<cwd (branch) [• name]>            <provider model-id [• thinking]>
<tps-meter status>                 <↑ ↓ R W CH $ ctx%>
[other extension statuses]
```

The bottom-left cell is reserved for the `tps` extension status (set by
`pi-tps-meter`); it stays blank when no stream is active. All other statuses
go on an optional 3rd line, sorted, with `tps` filtered out so it isn't
shown twice.

## Layout details

- **Top-left** — `cwd` (`$HOME` → `~`), then `(branch)` if in a git repo,
  then ` • <session-name>` if you set one with `/name`.
- **Top-right** — current `model.id`, with a `(<provider>) ` prefix only
  when more than one provider is available, and a ` • <thinking>` suffix
  (or ` • thinking off`) when the model supports reasoning.
- **Bottom-left** — raw themed text from the `tps` extension status, or
  blank when the meter is idle. Whatever the meter renders is what shows.
- **Bottom-right** — `↑in ↓out R read W write CH hit% $cost ctx%/window`.
  The `ctx%` segment is red above 90%, yellow above 70%, plain otherwise.

Truncation falls back: right cell first (no ellipsis), then left cell with
`...`. Both cells are dimmed by default, except the `tps` cell which keeps
its own colors (e.g. the accent dot from the meter).

## Differences from the built-in footer

- Layout is fixed 2×2 instead of 1 row of stats + a status row.
- The `tps` status is promoted to its own cell.
- No `xp` experimental indicator, no `(auto)` / `(sub)` suffixes (kept
  simpler; easy to add back).
- No dim wrapping around the colored context segment — `theme.fg("dim", …)`
  is applied to whole cells, and the context color codes are placed inside
  the right cell so the dim wrapper doesn't reset them.

## Install

```bash
cp -r extensions/pi-grid-footer ~/.pi/agent/extensions/pi-grid-footer
```

No `npm install` needed — only type-only imports from
`@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` (both
provided by pi itself).

Inside pi, run `/reload` to pick it up. To restore the default footer
temporarily, rename the folder out of `~/.pi/agent/extensions/` and reload.

## Caveats

- The `tps` key is hardcoded. If `pi-tps-meter` ever renames its status
  key, update `index.ts` to match (search for `statuses.get("tps")`).
- This extension always sets the footer in `session_start`. There's no
  toggle command — enable/disable by installing/uninstalling.
