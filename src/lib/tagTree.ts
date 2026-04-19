export interface TreeLeaf {
	kind: "tag";
	tag: string;
}

export interface TreeRoot {
	kind: "category" | "uncategorized";
	label: string;
	children: TreeLeaf[];
}

export interface BuildTreeInput {
	categories: readonly string[];
	forward: ReadonlyMap<string, ReadonlySet<string>>;
	reverse: ReadonlyMap<string, ReadonlySet<string>>;
	universeTags: readonly string[];
	showUncategorized: boolean;
}

export function buildTagTree(input: BuildTreeInput): TreeRoot[] {
	const roots: TreeRoot[] = [];
	for (const cat of input.categories) {
		const tags = Array.from(input.forward.get(cat) ?? []).sort(localeCompare);
		roots.push({
			kind: "category",
			label: cat,
			children: tags.map((tag) => ({ kind: "tag", tag })),
		});
	}
	if (input.showUncategorized) {
		const categorized = new Set<string>();
		for (const [tag, cats] of input.reverse) if (cats.size > 0) categorized.add(tag);
		const uncategorized = input.universeTags
			.map((t) => (t.startsWith("#") ? t.slice(1) : t))
			.filter((t) => t.length > 0 && !categorized.has(t))
			.filter(uniqueInPlace())
			.sort(localeCompare);
		if (uncategorized.length > 0) {
			roots.push({
				kind: "uncategorized",
				label: "Uncategorized",
				children: uncategorized.map((tag) => ({ kind: "tag", tag })),
			});
		}
	}
	return roots;
}

function localeCompare(a: string, b: string): number {
	return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function uniqueInPlace(): (v: string) => boolean {
	const seen = new Set<string>();
	return (v: string) => {
		if (seen.has(v)) return false;
		seen.add(v);
		return true;
	};
}
