/**
 * tool-permissions
 *
 * Per-tool permissions for a project, configured in `.pi/permission.json`:
 *
 *   {
 *     "bash": "ask",
 *     "write": "deny",
 *     "*": "allow"
 *   }
 *
 * Each tool maps to one of:
 *   "allow" — run without prompting (default for unlisted tools)
 *   "ask"   — confirm with the user before running; the prompt offers
 *             "Yes (this session)" to stop asking for the rest of the session.
 *             "No" (or Esc) blocks the call AND interrupts the turn, so the
 *             model stops instead of retrying via another tool (e.g. bash)
 *   "deny"  — block the tool call
 *   "*"     — catch-all rule for tools without an explicit entry
 *
 * While an "ask" prompt is on screen, the extension emits a
 * `herdr:blocked` event on pi's shared event bus so the herdr integration
 * (extensions/herdr-agent-state.ts, when installed) can report pi as
 * "blocked" and herdr can fire its needs-input toast/sound notification.
 * Without listeners the emit is a no-op.
 *
 * The file is re-read on every tool call, so edits take effect immediately
 * (no /reload). A missing file makes this extension a no-op.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Rule = "allow" | "ask" | "deny";
type Config = Record<string, Rule>;

const VALID_RULES = new Set<string>(["allow", "ask", "deny"]);
const SUMMARY_MAX = 200;
const ASK_OPTIONS = ["Yes", "Yes (this session)", "No"] as const;

/** Tools granted via "Yes (this session)"; cleared on session start. */
const grantedForSession = new Set<string>();

/** Config problems already reported this session, keyed by message text. */
const reportedProblems = new Set<string>();

function configPath(cwd: string): string {
	return join(cwd, CONFIG_DIR_NAME, "permission.json");
}

/**
 * Read `.pi/permission.json` fresh on every call so edits apply immediately.
 * Missing file → empty config (no rules, extension is a no-op). Invalid JSON
 * or shape → empty config plus a reported problem. Unknown rule values are
 * treated as "deny" (fail safe) and reported.
 */
async function loadConfig(
	cwd: string,
): Promise<{ config: Config; problem: string | null }> {
	const file = configPath(cwd);
	let raw: string;
	try {
		raw = await readFile(file, "utf-8");
	} catch {
		return { config: {}, problem: null }; // no file → no rules
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			config: {},
			problem: `Invalid JSON in ${file}; ignoring it (all tools allowed).`,
		};
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return {
			config: {},
			problem: `${file} must be a JSON object mapping tool → "allow" | "ask" | "deny"; ignoring it (all tools allowed).`,
		};
	}

	const config: Config = {};
	const invalid: string[] = [];
	for (const [tool, value] of Object.entries(parsed)) {
		if (typeof value === "string" && VALID_RULES.has(value)) {
			config[tool] = value as Rule;
		} else {
			invalid.push(`${tool}: ${JSON.stringify(value)}`);
			config[tool] = "deny"; // fail safe
		}
	}

	const problem =
		invalid.length > 0
			? `${file}: invalid rule(s) ${invalid.join(", ")} — treated as "deny".`
			: null;
	return { config, problem };
}

function ruleFor(config: Config, toolName: string): Rule {
	return config[toolName] ?? config["*"] ?? "allow";
}

/** One-line description of the call for the ask prompt. */
function summarize(input: object): string {
	const record = input as Record<string, unknown>;
	if (typeof record.command === "string" && record.command.length > 0) {
		return record.command;
	}
	if (typeof record.path === "string" && record.path.length > 0) {
		return record.path;
	}
	const json = JSON.stringify(record);
	return json.length > SUMMARY_MAX
		? `${json.slice(0, SUMMARY_MAX - 3)}...`
		: json;
}

/**
 * Tell the herdr integration (when loaded) whether pi is waiting on a
 * permission prompt. It translates this into herdr's "blocked" agent state,
 * which drives herdr's needs-input toast + request sound. No-op when no
 * extension listens on the event bus.
 */
function reportBlocked(pi: ExtensionAPI, active: boolean, label?: string): void {
	pi.events.emit("herdr:blocked", { active, label });
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", () => {
		grantedForSession.clear();
		reportedProblems.clear();
	});

	pi.on("tool_call", async (event, ctx) => {
		const { config, problem } = await loadConfig(ctx.cwd);
		if (problem !== null && !reportedProblems.has(problem)) {
			reportedProblems.add(problem);
			if (ctx.hasUI) {
				ctx.ui.notify(problem, "warning");
			}
		}

		const rule = ruleFor(config, event.toolName);
		if (rule === "allow" || grantedForSession.has(event.toolName)) {
			return undefined;
		}

		if (rule === "deny") {
			return {
				block: true,
				reason: `Tool "${event.toolName}" is denied by ${CONFIG_DIR_NAME}/permission.json`,
			};
		}

		// rule === "ask"
		const summary = summarize(event.input);
		if (!ctx.hasUI) {
			return {
				block: true,
				reason: `Tool "${event.toolName}" is set to "ask" in ${CONFIG_DIR_NAME}/permission.json but no UI is available; blocked.`,
			};
		}

		const choice = await (async () => {
			reportBlocked(pi, true, summary);
			try {
				return await ctx.ui.select(
					`Allow "${event.toolName}"?\n\n${summary}`,
					[...ASK_OPTIONS],
				);
			} finally {
				reportBlocked(pi, false);
			}
		})();
		if (choice === "Yes (this session)") {
			grantedForSession.add(event.toolName);
			return undefined;
		}
		if (choice === "Yes") {
			return undefined;
		}
		// "No" or dismissed (Esc) — block the call and interrupt the whole turn.
		// Without the abort the model would just retry via another tool (e.g.
		// write via bash); "No" should mean "stop so I can prompt again".
		// (The agent loop checks the abort signal right after the handler
		// returns, so the tool never runs and the run settles as aborted.)
		ctx.abort();
		return { block: true, reason: `Tool "${event.toolName}" rejected by user.` };
	});
}
