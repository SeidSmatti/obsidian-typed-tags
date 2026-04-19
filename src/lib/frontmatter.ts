import { normalize, normalizeAll } from "./tagNormalizer";

export type Frontmatter = Record<string, unknown>;

export function normalizeValue(raw: unknown): string[] {
	if (raw === null || raw === undefined) return [];
	if (Array.isArray(raw)) return normalizeAll(raw);
	if (typeof raw === "string") {
		const n = normalize(raw);
		return n === null ? [] : [n];
	}
	return [];
}

export interface TypedTagsPerFile {
	byCategory: Map<string, string[]>;
}

export function readTypedTags(
	frontmatter: Frontmatter | null | undefined,
	categories: readonly string[],
): TypedTagsPerFile {
	const byCategory = new Map<string, string[]>();
	if (!frontmatter) return { byCategory };
	for (const cat of categories) {
		if (!Object.prototype.hasOwnProperty.call(frontmatter, cat)) continue;
		const tags = normalizeValue(frontmatter[cat]);
		if (tags.length > 0) byCategory.set(cat, tags);
	}
	return { byCategory };
}

export interface FileEntry {
	path: string;
	frontmatter: Frontmatter | null | undefined;
}

export interface BuiltIndex {
	forward: Map<string, Set<string>>;
	reverse: Map<string, Set<string>>;
	perFile: Map<string, TypedTagsPerFile>;
}

export function buildIndexes(
	files: readonly FileEntry[],
	categories: readonly string[],
): BuiltIndex {
	const forward = new Map<string, Set<string>>();
	const reverse = new Map<string, Set<string>>();
	const perFile = new Map<string, TypedTagsPerFile>();
	for (const cat of categories) forward.set(cat, new Set());
	for (const file of files) {
		const entry = readTypedTags(file.frontmatter, categories);
		perFile.set(file.path, entry);
		for (const [cat, tags] of entry.byCategory) {
			const forwardSet = forward.get(cat) ?? new Set<string>();
			forward.set(cat, forwardSet);
			for (const tag of tags) {
				forwardSet.add(tag);
				let revSet = reverse.get(tag);
				if (!revSet) {
					revSet = new Set();
					reverse.set(tag, revSet);
				}
				revSet.add(cat);
			}
		}
	}
	return { forward, reverse, perFile };
}

export function applyIncrementalUpdate(
	index: BuiltIndex,
	path: string,
	next: TypedTagsPerFile,
): void {
	const prev = index.perFile.get(path);
	// Update perFile first so the "still present?" check below sees post-change state.
	if (next.byCategory.size === 0) index.perFile.delete(path);
	else index.perFile.set(path, next);

	if (prev) {
		for (const [cat, tags] of prev.byCategory) {
			for (const tag of tags) {
				if (tagStillAppearsInCategory(index, cat, tag)) continue;
				index.forward.get(cat)?.delete(tag);
				const rev = index.reverse.get(tag);
				rev?.delete(cat);
				if (rev && rev.size === 0) index.reverse.delete(tag);
			}
		}
	}
	for (const [cat, tags] of next.byCategory) {
		let fwd = index.forward.get(cat);
		if (!fwd) {
			fwd = new Set();
			index.forward.set(cat, fwd);
		}
		for (const tag of tags) {
			fwd.add(tag);
			let rev = index.reverse.get(tag);
			if (!rev) {
				rev = new Set();
				index.reverse.set(tag, rev);
			}
			rev.add(cat);
		}
	}
}

function tagStillAppearsInCategory(index: BuiltIndex, category: string, tag: string): boolean {
	for (const entry of index.perFile.values()) {
		const tags = entry.byCategory.get(category);
		if (tags && tags.includes(tag)) return true;
	}
	return false;
}

export function serializeIndex(index: BuiltIndex): {
	forward: Record<string, string[]>;
	reverse: Record<string, string[]>;
} {
	const forward: Record<string, string[]> = {};
	for (const [cat, tags] of index.forward) {
		forward[cat] = Array.from(tags).sort();
	}
	const reverse: Record<string, string[]> = {};
	for (const [tag, cats] of index.reverse) {
		reverse[tag] = Array.from(cats).sort();
	}
	return { forward, reverse };
}

export function indexHash(files: readonly FileEntry[], categories: readonly string[]): string {
	const parts: string[] = [];
	parts.push(`C:${[...categories].sort().join("|")}`);
	const fileSigs = files
		.map((f) => `${f.path}=${serializeFrontmatter(f.frontmatter, categories)}`)
		.sort();
	parts.push(`F:${fileSigs.join("\n")}`);
	return djb2(parts.join("\n"));
}

function serializeFrontmatter(fm: Frontmatter | null | undefined, categories: readonly string[]): string {
	if (!fm) return "";
	const pairs: string[] = [];
	for (const cat of [...categories].sort()) {
		if (!Object.prototype.hasOwnProperty.call(fm, cat)) continue;
		const tags = normalizeValue(fm[cat]).sort();
		pairs.push(`${cat}:${tags.join(",")}`);
	}
	return pairs.join(";");
}

function djb2(s: string): string {
	let h = 5381;
	for (let i = 0; i < s.length; i++) {
		h = ((h << 5) + h + s.charCodeAt(i)) | 0;
	}
	return (h >>> 0).toString(16);
}

export interface RenamePlan {
	changed: boolean;
	newFrontmatter: Frontmatter | null;
	reason?: "no-op-missing-key" | "collision-merged";
}

export function planRename(
	frontmatter: Frontmatter | null | undefined,
	from: string,
	to: string,
): RenamePlan {
	if (!frontmatter || !Object.prototype.hasOwnProperty.call(frontmatter, from)) {
		return { changed: false, newFrontmatter: null, reason: "no-op-missing-key" };
	}
	const oldValueNormalized = normalizeValue(frontmatter[from]);
	const next: Frontmatter = { ...frontmatter };
	if (Object.prototype.hasOwnProperty.call(next, to)) {
		const merged = normalizeAll([...normalizeValue(next[to]), ...oldValueNormalized]);
		next[to] = merged;
		delete next[from];
		return { changed: true, newFrontmatter: next, reason: "collision-merged" };
	}
	next[to] = oldValueNormalized;
	delete next[from];
	return { changed: true, newFrontmatter: next };
}
