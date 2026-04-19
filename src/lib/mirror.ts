export interface TagMirrorContext {
	categories(): readonly string[];
	typedTagsForPath(path: string): readonly string[];
	allFlatTags(): readonly string[];
}

export type FrontMatterShape = {
	tags?: unknown;
	tag?: unknown;
} & Record<string, unknown>;

export interface CachedMetadataShape {
	frontmatter?: FrontMatterShape;
}

export function augmentCache(
	raw: CachedMetadataShape | null,
	path: string,
	ctx: TagMirrorContext,
): CachedMetadataShape | null {
	if (raw === null) return null;
	const injected = ctx.typedTagsForPath(path);
	if (injected.length === 0) return raw;
	const clonedFm: FrontMatterShape = raw.frontmatter ? { ...raw.frontmatter } : {};
	const existing = collectFrontmatterTags(clonedFm);
	const existingSet = new Set(existing);
	const merged = existing.slice();
	for (const tag of injected) {
		if (!existingSet.has(tag)) {
			existingSet.add(tag);
			merged.push(tag);
		}
	}
	clonedFm.tags = merged;
	return { ...raw, frontmatter: clonedFm };
}

function collectFrontmatterTags(fm: FrontMatterShape): string[] {
	const out: string[] = [];
	const sources = [fm.tags, fm.tag];
	for (const src of sources) {
		if (Array.isArray(src)) {
			for (const v of src) if (typeof v === "string" && v.trim() !== "") out.push(v.trim());
		} else if (typeof src === "string") {
			for (const v of src.split(/[\s,]+/)) if (v.trim() !== "") out.push(v.trim());
		}
	}
	return out;
}

export function augmentTagUniverse(
	native: Record<string, number>,
	ctx: TagMirrorContext,
): Record<string, number> {
	const out: Record<string, number> = { ...native };
	for (const tag of ctx.allFlatTags()) {
		const key = tag.startsWith("#") ? tag : `#${tag}`;
		out[key] = (out[key] ?? 0) + 1;
	}
	return out;
}
