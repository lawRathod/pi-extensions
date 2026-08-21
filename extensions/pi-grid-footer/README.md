# pi-grid-footer

Replaces pi's built-in footer with a 2×2 layout:

```
<cwd (branch) [• name]>            <provider model-id [• thinking]>
<mcp status>                       <↑ ↓ R W CH $ ctx%>
[other extension statuses]
```

The bottom-left cell is reserved for the MCP status (set by `pi-mcp-adapter`
via `ctx.ui.setStatus("mcp", ...)`). It shows live connection progress
(`🔌 MCP: connecting…`, `N/M connected`, then `N enabled (N connected)`),
repainting on every update. All other statuses (including the `tps` meter)
go on an optional 3rd line, sorted, with `mcp` filtered out so it isn't
shown twice.

## Layout details

- **Top-left** — `cwd` (`$HOME` → `~`), then `(branch)` if in a git repo,
  then ` • <session-name>` if you set one with `/name`.
- **Top-right** — current `model.id`, with a `(<provider>) ` prefix only
  when more than one provider is available, and a ` • <thinking>` suffix
  (or ` • thinking off`) when the model supports reasoning.
- **Bottom-left** — MCP status from `pi-mcp-adapter`, kept raw so it keeps
  its own accent color. Blank when the adapter sets no status (e.g. no MCP
  servers configured).
- **Bottom-right** — `↑in ↓out R read W write CH hit% $cost ctx%/window`.
  The `ctx%` segment is red above 90%, yellow above 70%, plain otherwise.

The MCP cell repaints live by subscribing to pi-mcp-adapter's status bus
(`pi-mcp-adapter/status/v1`); each snapshot triggers `tui.requestRender()`.
This matters because `ctx.ui.setStatus` is fire-and-forget — custom footers
do not repaint on it on their own, so without the bus subscription the MCP
cell would stay stale until the next unrelated repaint.

Truncation falls back: right cell first (no ellipsis), then left cell with
`...`. Both cells are dimmed by default, except the MCP cell which keeps
its own colors.

## Differences from the built-in footer

- Layout is fixed 2×2 instead of 1 row of stats + a status row.
- The `mcp` status is promoted to its own cell.
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

- The `mcp` status key and the `pi-mcp-adapter/status/v1` channel are
  hardcoded. If the adapter ever renames them, update `index.ts` to match
  (search for `MCP_STATUS_EVENT` and `statuses.get("mcp")`).
- This extension always sets the footer in `session_start`. There's no
  toggle command — enable/disable by installing/uninstalling.
