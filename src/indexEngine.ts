import type { App, CachedMetadata, EventRef, TAbstractFile, TFile } from "obsidian";
import { CategoryRegistry } from "./categoryRegistry";
import { EventBus } from "./lib/events";
import {
	BuiltIndex,
	FileEntry,
	Frontmatter,
	applyIncrementalUpdate,
	buildIndexes,
	indexHash,
	readTypedTags,
	serializeIndex,
} from "./lib/frontmatter";
import type { IndexCache, PersistedState } from "./lib/persistence";

export class IndexEngine {
	private index: BuiltIndex = {
		forward: new Map(),
		reverse: new Map(),
		perFile: new Map(),
	};
	private lastHash = "";
	private disposers: Array<() => void> = [];

	constructor(
		private readonly app: App,
		private readonly registry: CategoryRegistry,
		private readonly bus: EventBus,
		private readonly persisted: PersistedState,
	) {}

	init(): void {
		const sig = this.snapshotHash();
		if (sig === this.persisted.indexCache.hash && this.persisted.indexCache.hash !== "") {
			this.restoreFromCache(this.persisted.indexCache);
			this.lastHash = sig;
			console.debug(`[typed-tags] index cache hit (${sig})`);
		} else {
			this.rebuildFull();
		}
		this.subscribe();
	}

	dispose(): void {
		for (const off of this.disposers) off();
		this.disposers = [];
	}

	getForward(): ReadonlyMap<string, ReadonlySet<string>> {
		return this.index.forward;
	}

	getReverse(): ReadonlyMap<string, ReadonlySet<string>> {
		return this.index.reverse;
	}

	getAllFlatTags(): readonly string[] {
		return Array.from(this.index.reverse.keys());
	}

	getPerFileEntry(path: string): import("./lib/frontmatter").TypedTagsPerFile | undefined {
		return this.index.perFile.get(path);
	}

	private subscribe(): void {
		const changedRef: EventRef = this.app.metadataCache.on(
			"changed",
			(file: TFile, _data: string, cache: CachedMetadata) => this.onFileChanged(file, cache),
		);
		const resolvedRef: EventRef = this.app.metadataCache.on("resolved", () => {
			if (this.snapshotHash() !== this.lastHash) this.rebuildFull();
		});
		const deleteRef: EventRef = this.app.vault.on("delete", (file: TAbstractFile) => {
			if (this.index.perFile.has(file.path)) this.rebuildFull();
		});
		this.disposers.push(() => this.app.metadataCache.offref(changedRef));
		this.disposers.push(() => this.app.metadataCache.offref(resolvedRef));
		this.disposers.push(() => this.app.vault.offref(deleteRef));
		this.disposers.push(
			this.bus.on("typed-tags:registry-changed", () => this.rebuildFull()),
		);
	}

	private onFileChanged(file: TFile, cache?: CachedMetadata): void {
		const fm = ((cache?.frontmatter ?? this.frontmatterFor(file.path)) as Frontmatter | null | undefined) ?? null;
		const categories = this.registry.list();
		const prev = this.index.perFile.get(file.path);
		const next = readTypedTags(fm, categories);
		if (!changed(prev, next)) return;
		this.applyIncremental(file.path, prev, next);
		this.lastHash = this.snapshotHash();
		this.persistSnapshot();
		this.bus.emit("typed-tags:index-updated", {
			changedTags: collectChangedTags(prev, next),
		});
	}

	rebuildFull(): void {
		const files = this.collectFiles();
		this.index = buildIndexes(files, this.registry.list());
		this.lastHash = this.snapshotHash();
		this.persistSnapshot();
		this.bus.emit("typed-tags:index-updated", { changedTags: [] });
	}

	private collectFiles(): FileEntry[] {
		const files = this.app.vault.getMarkdownFiles();
		return files.map((f) => ({
			path: f.path,
			frontmatter: this.frontmatterFor(f.path),
		}));
	}

	private frontmatterFor(path: string): Frontmatter | null | undefined {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file) return null;
		const cached = this.app.metadataCache.getCache(path);
		return (cached?.frontmatter as Frontmatter | undefined) ?? null;
	}

	private applyIncremental(
		path: string,
		_prev: import("./lib/frontmatter").TypedTagsPerFile | undefined,
		next: import("./lib/frontmatter").TypedTagsPerFile,
	): void {
		applyIncrementalUpdate(this.index, path, next);
		this.pruneCategoryPresence();
	}

	private pruneCategoryPresence(): void {
		const live = new Set(this.registry.list());
		for (const cat of Array.from(this.index.forward.keys())) {
			if (!live.has(cat)) this.index.forward.delete(cat);
		}
	}

	private snapshotHash(): string {
		return indexHash(this.collectFiles(), this.registry.list());
	}

	private restoreFromCache(cache: IndexCache): void {
		const forward = new Map<string, Set<string>>();
		for (const [cat, tags] of Object.entries(cache.forward)) {
			forward.set(cat, new Set(tags));
		}
		const reverse = new Map<string, Set<string>>();
		for (const [tag, cats] of Object.entries(cache.reverse)) {
			reverse.set(tag, new Set(cats));
		}
		this.index = { forward, reverse, perFile: new Map() };
		const files = this.collectFiles();
		for (const f of files) {
			const entry = readTypedTags(f.frontmatter, this.registry.list());
			if (entry.byCategory.size > 0) this.index.perFile.set(f.path, entry);
		}
	}

	private persistSnapshot(): void {
		const ser = serializeIndex(this.index);
		this.persisted.indexCache = {
			hash: this.lastHash,
			forward: ser.forward,
			reverse: ser.reverse,
		};
	}
}

function changed(
	prev: import("./lib/frontmatter").TypedTagsPerFile | undefined,
	next: import("./lib/frontmatter").TypedTagsPerFile,
): boolean {
	if (!prev) return next.byCategory.size > 0;
	if (prev.byCategory.size !== next.byCategory.size) return true;
	for (const [cat, tags] of next.byCategory) {
		const prevTags = prev.byCategory.get(cat);
		if (!prevTags) return true;
		if (prevTags.length !== tags.length) return true;
		for (let i = 0; i < tags.length; i++) if (prevTags[i] !== tags[i]) return true;
	}
	return false;
}

function collectChangedTags(
	prev: import("./lib/frontmatter").TypedTagsPerFile | undefined,
	next: import("./lib/frontmatter").TypedTagsPerFile,
): string[] {
	const set = new Set<string>();
	if (prev) for (const tags of prev.byCategory.values()) for (const t of tags) set.add(t);
	for (const tags of next.byCategory.values()) for (const t of tags) set.add(t);
	return Array.from(set);
}
