export const PERSISTED_SCHEMA_VERSION = 1 as const;

export interface CategoryRename {
	from: string;
	to: string;
	at: string;
}

export interface IndexCache {
	hash: string;
	forward: Record<string, string[]>;
	reverse: Record<string, string[]>;
}

export interface PluginSettings {
	restoreNativeTagPane: boolean;
	showUncategorized: boolean;
}

export interface PersistedState {
	version: typeof PERSISTED_SCHEMA_VERSION;
	categories: string[];
	categoryRenames: CategoryRename[];
	indexCache: IndexCache;
	settings: PluginSettings;
}

export function defaultState(): PersistedState {
	return {
		version: PERSISTED_SCHEMA_VERSION,
		categories: [],
		categoryRenames: [],
		indexCache: { hash: "", forward: {}, reverse: {} },
		settings: { restoreNativeTagPane: false, showUncategorized: true },
	};
}

export class PersistedStateError extends Error {
	constructor(message: string, readonly cause?: unknown) {
		super(message);
		this.name = "PersistedStateError";
	}
}

function isStringArray(x: unknown): x is string[] {
	return Array.isArray(x) && x.every((v) => typeof v === "string");
}

function validateIndexCache(x: unknown): IndexCache {
	if (!x || typeof x !== "object") throw new PersistedStateError("indexCache must be an object");
	const obj = x as Record<string, unknown>;
	if (typeof obj.hash !== "string") throw new PersistedStateError("indexCache.hash must be a string");
	if (!obj.forward || typeof obj.forward !== "object") throw new PersistedStateError("indexCache.forward must be an object");
	if (!obj.reverse || typeof obj.reverse !== "object") throw new PersistedStateError("indexCache.reverse must be an object");
	const forward: Record<string, string[]> = {};
	for (const [k, v] of Object.entries(obj.forward)) {
		if (!isStringArray(v)) throw new PersistedStateError(`indexCache.forward.${k} must be string[]`);
		forward[k] = v.slice();
	}
	const reverse: Record<string, string[]> = {};
	for (const [k, v] of Object.entries(obj.reverse)) {
		if (!isStringArray(v)) throw new PersistedStateError(`indexCache.reverse.${k} must be string[]`);
		reverse[k] = v.slice();
	}
	return { hash: obj.hash, forward, reverse };
}

function validateSettings(x: unknown): PluginSettings {
	const d = defaultState().settings;
	if (!x || typeof x !== "object") return d;
	const obj = x as Record<string, unknown>;
	return {
		restoreNativeTagPane: typeof obj.restoreNativeTagPane === "boolean" ? obj.restoreNativeTagPane : d.restoreNativeTagPane,
		showUncategorized: typeof obj.showUncategorized === "boolean" ? obj.showUncategorized : d.showUncategorized,
	};
}

function validateRenames(x: unknown): CategoryRename[] {
	if (!Array.isArray(x)) throw new PersistedStateError("categoryRenames must be an array");
	return x.map((entry, i) => {
		if (!entry || typeof entry !== "object") throw new PersistedStateError(`categoryRenames[${i}] must be an object`);
		const e = entry as Record<string, unknown>;
		if (typeof e.from !== "string" || typeof e.to !== "string" || typeof e.at !== "string") {
			throw new PersistedStateError(`categoryRenames[${i}] must have string from, to, at`);
		}
		return { from: e.from, to: e.to, at: e.at };
	});
}

export function validate(raw: unknown): PersistedState {
	if (raw === null || raw === undefined) return defaultState();
	if (typeof raw !== "object") throw new PersistedStateError("persisted state must be an object");
	const obj = raw as Record<string, unknown>;
	if (obj.version !== PERSISTED_SCHEMA_VERSION) {
		throw new PersistedStateError(`unsupported persisted schema version: ${String(obj.version)}`);
	}
	if (!isStringArray(obj.categories)) throw new PersistedStateError("categories must be string[]");
	return {
		version: PERSISTED_SCHEMA_VERSION,
		categories: obj.categories.slice(),
		categoryRenames: validateRenames(obj.categoryRenames),
		indexCache: validateIndexCache(obj.indexCache),
		settings: validateSettings(obj.settings),
	};
}
