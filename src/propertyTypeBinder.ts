import type { App } from "obsidian";
import { CategoryRegistry } from "./categoryRegistry";
import { EventBus } from "./lib/events";

const TAGS_TYPE = "tags";

export class PropertyTypeBinder {
	private originalTypes = new Map<string, string | null>();
	private unsubscribe?: () => void;
	private active = false;

	constructor(
		private readonly app: App,
		private readonly registry: CategoryRegistry,
		private readonly bus: EventBus,
	) {}

	install(): void {
		if (this.active) return;
		this.active = true;
		this.applyAll();
		this.unsubscribe = this.bus.on("typed-tags:registry-changed", () => this.applyAll());
	}

	uninstall(): void {
		if (!this.active) return;
		this.active = false;
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.restoreAll();
	}

	private applyAll(): void {
		const mtm = this.app.metadataTypeManager;
		if (!mtm || typeof mtm.setType !== "function") return;
		const live = new Set(this.registry.list());
		for (const key of live) {
			if (!this.originalTypes.has(key)) {
				const current = (mtm.getAssignedType?.(key) ?? null) as string | null;
				this.originalTypes.set(key, current);
			}
			mtm.setType(key, TAGS_TYPE);
		}
		for (const key of Array.from(this.originalTypes.keys())) {
			if (!live.has(key)) this.restoreOne(key);
		}
	}

	private restoreAll(): void {
		for (const key of Array.from(this.originalTypes.keys())) this.restoreOne(key);
	}

	private restoreOne(key: string): void {
		const mtm = this.app.metadataTypeManager;
		const prev = this.originalTypes.get(key);
		this.originalTypes.delete(key);
		if (!mtm || typeof mtm.setType !== "function") return;
		if (prev === null || prev === undefined) {
			// Obsidian has no API to un-assign; leave as tags (user can change manually).
			// Documented as an accepted limitation — see ARCHITECTURE.md §5.
			return;
		}
		mtm.setType(key, prev);
	}

}
