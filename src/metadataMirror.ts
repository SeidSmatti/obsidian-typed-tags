import { around } from "monkey-around";
import type { App, CachedMetadata, TFile } from "obsidian";
import type { IndexEngine } from "./indexEngine";
import { augmentCache, augmentTagUniverse, TagMirrorContext } from "./lib/mirror";

export class MetadataMirror {
	private uninstallers: Array<() => void> = [];

	constructor(private readonly app: App, private readonly index: IndexEngine) {}

	install(): void {
		const ctx: TagMirrorContext = {
			categories: () => [],
			typedTagsForPath: (p) => this.typedTagsForPath(p),
			allFlatTags: () => this.index.getAllFlatTags(),
		};

		const mc = this.app.metadataCache;

		this.uninstallers.push(
			around(mc as unknown as Record<string, (...a: unknown[]) => unknown>, {
				getFileCache:
					(next) =>
					function (this: unknown, file: TFile): CachedMetadata | null {
						const raw = next.call(this, file) as CachedMetadata | null;
						return augmentCache(raw, file?.path ?? "", ctx) as CachedMetadata | null;
					} as unknown as (...a: unknown[]) => unknown,
				getCache:
					(next) =>
					function (this: unknown, path: string): CachedMetadata | null {
						const raw = next.call(this, path) as CachedMetadata | null;
						return augmentCache(raw, path, ctx) as CachedMetadata | null;
					} as unknown as (...a: unknown[]) => unknown,
			}),
		);

		if (typeof (mc as unknown as { getTags?: () => Record<string, number> }).getTags === "function") {
			this.uninstallers.push(
				around(mc as unknown as Record<string, (...a: unknown[]) => unknown>, {
					getTags:
						(next) =>
						function (this: unknown): Record<string, number> {
							const native = next.call(this) as Record<string, number>;
							return augmentTagUniverse(native, ctx);
						} as unknown as (...a: unknown[]) => unknown,
				}),
			);
		}
	}

	uninstall(): void {
		for (const u of this.uninstallers) u();
		this.uninstallers = [];
	}

	private typedTagsForPath(path: string): string[] {
		const perFileEntry = this.index.getPerFileEntry(path);
		if (!perFileEntry) return [];
		const result = new Set<string>();
		for (const tags of perFileEntry.byCategory.values()) {
			for (const tag of tags) result.add(tag);
		}
		return Array.from(result);
	}
}
