/**
 * pi-grid-footer
 *
 * Replaces the built-in footer with a 2x2 layout:
 *
 *   <pwd (branch) [• name]>                    <provider model [• thinking]>
 *   <extension statuses except "tps">          <stats>
 *
 * The "tps" extension status (set by pi-tps-meter) is reserved for the
 * bottom-left cell. Any other extension statuses (set via ctx.ui.setStatus)
 * are collected on a 3rd line, minus "tps" so they aren't shown twice.
 *
 * Self-written. No file or network I/O.
 */

import { isAbsolute, relative, resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// Mirror of the default footer's compact token formatter. Kept inline so this
// extension has zero runtime dependencies.
function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

function formatCwd(cwd: string, home: string | undefined): string {
	if (!home) return cwd;
	const resolvedCwd = resolve(cwd);
	const resolvedHome = resolve(home);
	const rel = relative(resolvedHome, resolvedCwd);
	const inside =
		rel === "" ||
		(rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
	if (!inside) return cwd;
	return rel === "" ? "~" : `~${sep}${rel}`;
}

// Sanitize extension-status text for a single line (strip CR/LF/tab runs).
function sanitizeStatus(text: string): string {
	return text.replace(/[\r\n\t]+/g, " ").replace(/ +/g, " ").trim();
}

export default function gridFooter(pi: ExtensionAPI): void {
	// Track thinking level + reasoning support across the session. Both can
	// change at runtime, so we update on the dedicated events and read from
	// these locals during render (ctx doesn't expose them directly).
	let thinkingLevel: string | undefined;
	let modelSupportsReasoning = false;

	pi.on("model_select", async (event) => {
		modelSupportsReasoning = !!(event.model as { reasoning?: unknown })?.reasoning;
	});

	pi.on("thinking_level_select", async (event) => {
		thinkingLevel = event.level as string;
	});

	pi.on("session_start", async (_event, ctx) => {
		// Seed from current model if a model_select already fired before us.
		modelSupportsReasoning = !!((ctx.model as { reasoning?: unknown } | undefined)?.reasoning);

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsubBranch = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: unsubBranch,
				invalidate() {},
				render(width: number): string[] {
					const home = process.env.HOME || process.env.USERPROFILE;
					const cwd = formatCwd(ctx.sessionManager.getCwd(), home);
					const branch = footerData.getGitBranch();
					const sessionName = ctx.sessionManager.getSessionName();

					let leftTop = cwd;
					if (branch) leftTop = `${leftTop} (${branch})`;
					if (sessionName) leftTop = `${leftTop} • ${sessionName}`;

					// Right top: model + optional thinking + optional provider prefix.
					const stateModel = ctx.model;
					let rightTop = stateModel?.id || "no-model";
					if (modelSupportsReasoning) {
						const tl = thinkingLevel || "off";
						rightTop = tl === "off" ? `${rightTop} • thinking off` : `${rightTop} • ${tl}`;
					}
					if (footerData.getAvailableProviderCount() > 1 && stateModel) {
						rightTop = `(${stateModel.provider}) ${rightTop}`;
					}

					// Left bottom: tps meter (raw themed text), or blank when idle.
					const statuses = footerData.getExtensionStatuses();
					const tpsText = statuses.get("tps");
					const leftBottom = tpsText ?? "";

					// Token / cost / context stats from the session.
					let totalInput = 0;
					let totalOutput = 0;
					let totalCacheRead = 0;
					let totalCacheWrite = 0;
					let totalCost = 0;
					let latestHitRate: number | undefined;
					for (const entry of ctx.sessionManager.getEntries()) {
						if (entry.type !== "message") continue;
						const msg = entry.message as { role?: string; usage?: any };
						if (msg.role !== "assistant" || !msg.usage) continue;
						const u = msg.usage;
						totalInput += u.input ?? 0;
						totalOutput += u.output ?? 0;
						totalCacheRead += u.cacheRead ?? 0;
						totalCacheWrite += u.cacheWrite ?? 0;
						totalCost += u.cost?.total ?? 0;
						const prompt = (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
						if (prompt > 0) latestHitRate = ((u.cacheRead ?? 0) / prompt) * 100;
					}

					const usage = ctx.getContextUsage();
					const contextWindow = usage?.contextWindow ?? stateModel?.contextWindow ?? 0;
					const ctxPct: number | undefined = typeof usage?.percent === "number" ? usage.percent : undefined;

					const statsParts: string[] = [];
					if (totalInput) statsParts.push(`↑${formatTokens(totalInput)}`);
					if (totalOutput) statsParts.push(`↓${formatTokens(totalOutput)}`);
					if (totalCacheRead) statsParts.push(`R${formatTokens(totalCacheRead)}`);
					if (totalCacheWrite) statsParts.push(`W${formatTokens(totalCacheWrite)}`);
					if ((totalCacheRead > 0 || totalCacheWrite > 0) && latestHitRate !== undefined) {
						statsParts.push(`CH${latestHitRate.toFixed(1)}%`);
					}
					if (totalCost) statsParts.push(`$${totalCost.toFixed(3)}`);

					const ctxDisplay =
						ctxPct === undefined
							? `?/${formatTokens(contextWindow)}`
							: `${ctxPct.toFixed(1)}%/${formatTokens(contextWindow)}`;
					let ctxStr: string;
					if (ctxPct === undefined) {
						ctxStr = ctxDisplay;
					} else if (ctxPct > 90) {
						ctxStr = theme.fg("error", ctxDisplay);
					} else if (ctxPct > 70) {
						ctxStr = theme.fg("warning", ctxDisplay);
					} else {
						ctxStr = ctxDisplay;
					}
					statsParts.push(ctxStr);
					const statsText = statsParts.join(" ");

					const dim = (s: string) => theme.fg("dim", s);

					// Row 1: leftTop (dim) | rightTop (dim, right-aligned).
					const line1 = renderRow(leftTop, rightTop, width, dim);
					// Row 2: tps (raw themed, keeps its own colors) | statsText (dim).
					const line2 = renderRow(leftBottom, statsText, width, dim, /* leftRaw */ true);

					// Row 3: any other extension statuses, sorted by key, sans "tps".
					const otherStatuses: string[] = [];
					for (const [k, v] of statuses) {
						if (k === "tps") continue;
						otherStatuses.push(sanitizeStatus(v));
					}
					const lines = [line1, line2];
					if (otherStatuses.length > 0) {
						const statusLine = otherStatuses.join(" ");
						lines.push(dim(truncateToWidth(statusLine, width, theme.fg("dim", "..."))));
					}
					return lines;
				},
			};
		});
	});
}

function renderRow(
	left: string,
	right: string,
	width: number,
	style: (s: string) => string,
	leftRaw = false,
): string {
	const lw = visibleWidth(left);
	const rw = visibleWidth(right);
	const gap = 2;

	// Both fit naturally.
	if (lw + gap + rw <= width) {
		const pad = " ".repeat(width - lw - rw);
		return (leftRaw ? left : style(left)) + pad + style(right);
	}

	// Right doesn't fit, but left does — push right off and keep left.
	if (lw <= width) {
		const rightAvail = width - lw - gap;
		const trimmedRight = rightAvail > 0 ? truncateToWidth(right, rightAvail, "") : "";
		const pad = " ".repeat(Math.max(0, width - lw - visibleWidth(trimmedRight)));
		return (leftRaw ? left : style(left)) + pad + style(trimmedRight);
	}

	// Neither fits as a row — just show the left cell, dimmed + truncated.
	return style(truncateToWidth(left, width, ""));
}
