import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";

import { loadConfig, resetCache, setConfig, type CustomMessageConfig } from "./settings";

const MAX_MESSAGE_LENGTH = 160;
const MAX_LINE_LENGTH_HARD_CAP = 2000;

interface State {
	lines: string[];
	used: Set<string>;
	timer: ReturnType<typeof setInterval> | null;
	config: CustomMessageConfig;
}

const state: State = {
	lines: [],
	used: new Set(),
	timer: null,
	config: { enabled: true, rotateSeconds: 10, filePath: "" },
};

/**
 * Read the user's message file. One message per line.
 * - Lines starting with `#` are comments.
 * - Blank lines are skipped.
 * - Lines longer than MAX_LINE_LENGTH_HARD_CAP are skipped (almost certainly
 *   a mistake; the working-message area is narrow).
 * - Lines are collapsed to single spaces and trimmed.
 * Missing or unreadable file returns an empty array — the extension is then
 * a no-op for the session, which is the right graceful behavior.
 */
async function loadMessages(filePath: string): Promise<string[]> {
	let raw: string;
	try {
		raw = await readFile(filePath, "utf-8");
	} catch {
		return [];
	}

	const out: string[] = [];
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		if (trimmed.startsWith("#")) continue;
		if (trimmed.length > MAX_LINE_LENGTH_HARD_CAP) continue;
		const collapsed = trimmed.replace(/\s+/g, " ");
		out.push(
			collapsed.length > MAX_MESSAGE_LENGTH
				? collapsed.slice(0, MAX_MESSAGE_LENGTH - 1) + "…"
				: collapsed,
		);
	}
	return out;
}

function pickLine(): string | null {
	if (state.lines.length === 0) return null;

	if (state.used.size >= state.lines.length) {
		state.used.clear();
	}
	const available = state.lines.filter((line) => !state.used.has(line));
	const choice = available[Math.floor(Math.random() * available.length)];
	if (choice === undefined) return null;
	state.used.add(choice);
	return choice;
}

function clearTimer(): void {
	if (state.timer !== null) {
		clearInterval(state.timer);
		state.timer = null;
	}
}

function applyLine(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	const line = pickLine();
	if (line === null) return;
	ctx.ui.setWorkingMessage(line);
}

function startTurn(ctx: ExtensionContext): void {
	if (!ctx.hasUI || !state.config.enabled) return;
	if (state.lines.length === 0) return;

	applyLine(ctx);

	const intervalMs = state.config.rotateSeconds * 1000;
	if (intervalMs > 0) {
		state.timer = setInterval(() => applyLine(ctx), intervalMs);
	}
}

function endTurn(ctx: ExtensionContext): void {
	clearTimer();
	if (ctx.hasUI) {
		ctx.ui.setWorkingMessage();
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		state.config = await loadConfig();
		state.lines = await loadMessages(state.config.filePath);
		state.used.clear();
	});

	pi.on("turn_start", (_event, ctx) => {
		startTurn(ctx);
	});

	pi.on("turn_end", (_event, ctx) => {
		endTurn(ctx);
	});

	pi.on("agent_settled", (_event, ctx) => {
		// Safety net so the timer never leaks past the end of an agent run.
		endTurn(ctx);
	});

	pi.on("session_shutdown", () => {
		clearTimer();
		resetCache();
	});

	pi.registerCommand("custom", {
		description: "Toggle the custom working message. Use: /custom, /custom on, /custom off.",
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			if (!trimmed) {
				ctx.ui.notify(
					`Custom message: ${state.config.enabled ? "on" : "off"}, rotate: ${state.config.rotateSeconds}s, file: ${state.config.filePath} (${state.lines.length} lines)`,
					"info",
				);
				return;
			}

			const verb = trimmed.split(/\s+/)[0]?.toLowerCase();
			if (verb === "on" || verb === "off") {
				state.config = await setConfig({ enabled: verb === "on" });
				ctx.ui.notify(
					`Custom message ${state.config.enabled ? "enabled" : "disabled"}.`,
					"info",
				);
				return;
			}

			ctx.ui.notify("Usage: /custom | /custom on | /custom off", "warning");
		},
	});
}
