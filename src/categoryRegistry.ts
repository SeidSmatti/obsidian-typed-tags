import { EventBus } from "./lib/events";

export class CategoryRegistryError extends Error {
	constructor(message: string, readonly code: "empty" | "duplicate" | "missing" | "collision") {
		super(message);
		this.name = "CategoryRegistryError";
	}
}

export function normalizeCategoryKey(raw: string): string | null {
	const trimmed = raw.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export class CategoryRegistry {
	private categories: string[];

	constructor(initial: readonly string[], private readonly bus: EventBus) {
		this.categories = initial.slice();
	}

	list(): readonly string[] {
		return this.categories.slice();
	}

	has(key: string): boolean {
		return this.categories.includes(key);
	}

	add(rawKey: string): string {
		const key = normalizeCategoryKey(rawKey);
		if (key === null) {
			throw new CategoryRegistryError("category key must be non-empty", "empty");
		}
		if (this.has(key)) {
			throw new CategoryRegistryError(`category "${key}" already exists`, "duplicate");
		}
		this.categories.push(key);
		this.emitChanged();
		return key;
	}

	remove(key: string): void {
		const i = this.categories.indexOf(key);
		if (i < 0) {
			throw new CategoryRegistryError(`category "${key}" not found`, "missing");
		}
		this.categories.splice(i, 1);
		this.emitChanged();
	}

	rename(from: string, rawTo: string): string {
		const to = normalizeCategoryKey(rawTo);
		if (to === null) {
			throw new CategoryRegistryError("new category key must be non-empty", "empty");
		}
		const i = this.categories.indexOf(from);
		if (i < 0) {
			throw new CategoryRegistryError(`category "${from}" not found`, "missing");
		}
		if (to === from) return to;
		if (this.categories.includes(to)) {
			throw new CategoryRegistryError(`cannot rename to "${to}": already exists`, "collision");
		}
		this.categories[i] = to;
		this.emitChanged();
		return to;
	}

	replaceAll(next: readonly string[]): void {
		this.categories = next.slice();
		this.emitChanged();
	}

	private emitChanged(): void {
		this.bus.emit("typed-tags:registry-changed", { categories: this.list() });
	}
}
