import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface FunFactsConfig {
	enabled: boolean;
	rotateSeconds: number;
	useApi: boolean;
}

const DEFAULTS: FunFactsConfig = {
	enabled: true,
	rotateSeconds: 10,
	useApi: false,
};

const SETTINGS_KEY = "funFacts";
const SETTINGS_PATH = join(getAgentDir(), "settings.json");

let cached: FunFactsConfig | null = null;

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function validate(raw: unknown): FunFactsConfig {
	if (!isPlainObject(raw)) return { ...DEFAULTS };

	const enabled =
		typeof raw.enabled === "boolean" ? raw.enabled : DEFAULTS.enabled;

	const rotateSeconds =
		typeof raw.rotateSeconds === "number" && Number.isFinite(raw.rotateSeconds)
			? clamp(Math.floor(raw.rotateSeconds), 0, 300)
			: DEFAULTS.rotateSeconds;

	const useApi =
		typeof raw.useApi === "boolean" ? raw.useApi : DEFAULTS.useApi;

	return { enabled, rotateSeconds, useApi };
}

async function readAll(): Promise<Record<string, unknown>> {
	try {
		const raw = await readFile(SETTINGS_PATH, "utf-8");
		const parsed = JSON.parse(raw);
		return isPlainObject(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

async function writeAll(data: Record<string, unknown>): Promise<void> {
	await writeFile(SETTINGS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function loadConfig(): Promise<FunFactsConfig> {
	if (cached) return cached;
	const all = await readAll();
	cached = validate(all[SETTINGS_KEY]);
	return cached;
}

export async function setConfig(
	partial: Partial<FunFactsConfig>,
): Promise<FunFactsConfig> {
	const current = await loadConfig();
	const next = validate({ ...current, ...partial });
	cached = next;

	const all = await readAll();
	all[SETTINGS_KEY] = next;
	await writeAll(all);

	return next;
}

export function resetCache(): void {
	cached = null;
}
