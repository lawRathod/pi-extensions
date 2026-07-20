import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { BUNDLED_FACTS } from "./facts";
import { loadConfig, resetCache, setConfig, type FunFactsConfig } from "./settings";

const API_URL = "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en";
const API_TIMEOUT_MS = 3000;
const USER_FACTS_PATH = join(getAgentDir(), "fun-facts.txt");
const MAX_FACT_LENGTH = 160;

interface State {
	pool: string[];
	used: Set<string>;
	timer: ReturnType<typeof setInterval> | null;
	config: FunFactsConfig;
}

const state: State = {
	pool: [...BUNDLED_FACTS],
	used: new Set(),
	timer: null,
	config: { enabled: true, rotateSeconds: 10, useApi: false },
};

/**
 * Read the user's optional fun-facts.txt (one fact per line, # for comments)
 * and append any non-empty lines to the bundled pool.
 */
async function loadUserFacts(): Promise<string[]> {
	try {
		const raw = await readFile(USER_FACTS_PATH, "utf-8");
		return raw
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.startsWith("#"));
	} catch {
		return [];
	}
}

function trimFact(text: string): string {
	const collapsed = text.replace(/\s+/g, " ").trim();
	return collapsed.length > MAX_FACT_LENGTH
		? collapsed.slice(0, MAX_FACT_LENGTH - 1) + "…"
		: collapsed;
}

function pickFromPool(): string {
	if (state.pool.length === 0) {
		state.used.clear();
		state.pool = [...BUNDLED_FACTS];
	}
	if (state.used.size >= state.pool.length) {
		state.used.clear();
	}
	const available = state.pool.filter((f) => !state.used.has(f));
	const choice = available[Math.floor(Math.random() * available.length)]!;
	state.used.add(choice);
	return choice;
}

async function fetchApiFact(): Promise<string | null> {
	try {
		const res = await fetch(API_URL, {
			signal: AbortSignal.timeout(API_TIMEOUT_MS),
			headers: { Accept: "application/json", "User-Agent": "pi-fun-facts-extension" },
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { text?: unknown };
		if (typeof data.text !== "string" || data.text.trim().length === 0) return null;
		return trimFact(data.text);
	} catch {
		return null;
	}
}

async function pickFact(): Promise<string> {
	if (state.config.useApi) {
		const api = await fetchApiFact();
		if (api) return api;
	}
	return pickFromPool();
}

function clearTimer(): void {
	if (state.timer !== null) {
		clearInterval(state.timer);
		state.timer = null;
	}
}

async function applyFact(ctx: ExtensionContext): Promise<void> {
	if (!ctx.hasUI) return;
	const fact = await pickFact();
	ctx.ui.setWorkingMessage(fact);
}

function startTurn(ctx: ExtensionContext): void {
	if (!ctx.hasUI || !state.config.enabled) return;

	void applyFact(ctx);

	const intervalMs = state.config.rotateSeconds * 1000;
	if (intervalMs > 0) {
		state.timer = setInterval(() => {
			void applyFact(ctx);
		}, intervalMs);
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
		state.pool = [...BUNDLED_FACTS, ...(await loadUserFacts())];
		state.used.clear();
	});

	pi.on("turn_start", (_event, ctx) => {
		// turnIndex is available if we ever want to skip the first turn.
		startTurn(ctx);
	});

	pi.on("turn_end", (_event, ctx) => {
		endTurn(ctx);
	});

	pi.on("agent_settled", (_event, ctx) => {
		// Safety net: make sure no timer leaks across agent boundaries.
		endTurn(ctx);
	});

	pi.on("session_shutdown", () => {
		clearTimer();
		resetCache();
	});

	pi.registerCommand("facts", {
		description: "Toggle fun facts in the working message. Use: /facts, /facts on, /facts off, /facts api on|off.",
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			if (!trimmed) {
				ctx.ui.notify(
					`Fun facts: ${state.config.enabled ? "on" : "off"}, source: ${state.config.useApi ? "api" : "bundled"}, rotate: ${state.config.rotateSeconds}s`,
					"info",
				);
				return;
			}

			const tokens = trimmed.split(/\s+/);
			const verb = tokens[0]?.toLowerCase();

			if (verb === "on" || verb === "off") {
				state.config = await setConfig({ enabled: verb === "on" });
				ctx.ui.notify(`Fun facts ${state.config.enabled ? "enabled" : "disabled"}.`, "info");
				return;
			}

			if (verb === "api" && (tokens[1] === "on" || tokens[1] === "off")) {
				state.config = await setConfig({ useApi: tokens[1] === "on" });
				ctx.ui.notify(
					`API source ${state.config.useApi ? "enabled" : "disabled"}.`,
					"info",
				);
				return;
			}

			ctx.ui.notify(
				"Usage: /facts | /facts on | /facts off | /facts api on | /facts api off",
				"warning",
			);
		},
	});
}
