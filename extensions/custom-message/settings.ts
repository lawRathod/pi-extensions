import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface CustomMessageConfig {
	enabled: boolean;
	rotateSeconds: number;
	filePath: string;
}

const DEFAULT_FILE_PATH = join(getAgentDir(), "custom-message.txt");

const DEFAULTS: CustomMessageConfig = {
	enabled: true,
	rotateSeconds: 20,
	filePath: DEFAULT_FILE_PATH,
};

const SETTINGS_KEY = "customMessage";
const SETTINGS_PATH = join(getAgentDir(), "settings.json");

let cached: CustomMessageConfig | null = null;

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function validate(raw: unknown): CustomMessageConfig {
	if (!isPlainObject(raw)) return { ...DEFAULTS };

	const enabled =
		typeof raw.enabled === "boolean" ? raw.enabled : DEFAULTS.enabled;

	const rotateSeconds =
		typeof raw.rotateSeconds === "number" && Number.isFinite(raw.rotateSeconds)
			? clamp(Math.floor(raw.rotateSeconds), 0, 300)
			: DEFAULTS.rotateSeconds;

	const filePath =
		typeof raw.filePath === "string" && raw.filePath.trim().length > 0
			? raw.filePath.trim()
			: DEFAULTS.filePath;

	return { enabled, rotateSeconds, filePath };
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

export async function loadConfig(): Promise<CustomMessageConfig> {
	if (cached) return cached;
	const all = await readAll();
	cached = validate(all[SETTINGS_KEY]);
	return cached;
}

export async function setConfig(
	partial: Partial<CustomMessageConfig>,
): Promise<CustomMessageConfig> {
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
