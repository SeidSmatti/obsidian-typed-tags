// Declaration merges for unstable / undocumented Obsidian API surface.
// Every entry here is paired with a fallback strategy in ARCHITECTURE.md §5.

import "obsidian";

declare module "obsidian" {
	interface MetadataCache {
		/**
		 * Undocumented: returns a tag-universe map `{ "#tagname": count }`.
		 * Fallback: if signature changes, our mirror degrades to only augmenting
		 * `CachedMetadata.frontmatter` for Dataview-style queries.
		 */
		getTags?(): Record<string, number>;
	}

	interface App {
		/**
		 * Undocumented: registers YAML property types so the Properties panel renders them specially.
		 * Fallback: without it, pill rendering still works via the CodeMirror extension + markdown post-processor;
		 * Properties panel falls back to raw text/list rendering.
		 */
		metadataTypeManager?: MetadataTypeManager;
	}

	interface MetadataTypeManager {
		setType?(key: string, type: string): void;
		getAssignedType?(key: string): string | null;
		registeredTypeWidgets?: Record<string, unknown>;
	}
}
