import { describe, it, expect } from "vitest";
import { buildIndexes, FileEntry } from "../../src/lib/frontmatter";
import { CategoryRegistry } from "../../src/categoryRegistry";
import { EventBus } from "../../src/lib/events";
import { buildTagTree } from "../../src/lib/tagTree";

describe("Phase 8 — edge cases", () => {
	it("multi-category fixture (#apple ∈ {Food, Companies}) builds both forward entries", () => {
		const files: FileEntry[] = [
			{ path: "fruit.md", frontmatter: { Food: ["apple"] } },
			{ path: "corp.md", frontmatter: { Companies: ["apple"] } },
		];
		const idx = buildIndexes(files, ["Food", "Companies"]);
		expect([...idx.forward.get("Food")!]).toEqual(["apple"]);
		expect([...idx.forward.get("Companies")!]).toEqual(["apple"]);
		expect([...idx.reverse.get("apple")!].sort()).toEqual(["Companies", "Food"]);
	});

	it("removing one category mapping from a single note does not delete the tag from the other category", () => {
		// Round 1: apple in both Food and Companies
		const before: FileEntry[] = [
			{ path: "fruit.md", frontmatter: { Food: ["apple"], Companies: ["apple"] } },
		];
		const idx1 = buildIndexes(before, ["Food", "Companies"]);
		expect([...idx1.reverse.get("apple")!].sort()).toEqual(["Companies", "Food"]);
		// Round 2: user removes Companies from the note's frontmatter; rebuild
		const after: FileEntry[] = [
			{ path: "fruit.md", frontmatter: { Food: ["apple"] } },
		];
		const idx2 = buildIndexes(after, ["Food", "Companies"]);
		expect([...idx2.reverse.get("apple")!]).toEqual(["Food"]);
	});

	it("removing a category from the registry never reaches into note frontmatter (pure registry)", () => {
		const bus = new EventBus();
		const reg = new CategoryRegistry(["People", "Companies"], bus);
		// Spy: any write attempt would have to go through external dependencies.
		// CategoryRegistry has no vault reference at all — verified structurally.
		reg.remove("Companies");
		expect(reg.list()).toEqual(["People"]);
		// Hardcoded: the constructor signature accepts only `(initial, bus)`.
		expect((reg as unknown as { app?: unknown }).app).toBeUndefined();
		expect((reg as unknown as { vault?: unknown }).vault).toBeUndefined();
	});

	it("empty-string and whitespace-only typed-property values are dropped from the index", () => {
		const files: FileEntry[] = [
			{ path: "edge.md", frontmatter: { People: ["", "   ", "JohnDoe"] } },
		];
		const idx = buildIndexes(files, ["People"]);
		expect([...idx.forward.get("People")!]).toEqual(["JohnDoe"]);
	});

	it("unicode tag names survive normalization, indexing, and tree building", () => {
		const files: FileEntry[] = [
			{ path: "u.md", frontmatter: { People: ["日本語", "café", "🌍"] } },
		];
		const idx = buildIndexes(files, ["People"]);
		const tree = buildTagTree({
			categories: ["People"],
			forward: idx.forward,
			reverse: idx.reverse,
			universeTags: [...idx.reverse.keys()].map((t) => `#${t}`),
			showUncategorized: false,
		});
		expect(tree[0].children.map((c) => c.tag).sort()).toEqual(["café", "日本語", "🌍"].sort());
	});

	it("Uncategorized bucket appears for typed tags whose categories were unregistered", () => {
		const files: FileEntry[] = [
			{ path: "x.md", frontmatter: { OldKey: ["legacy"] } },
		];
		const idx = buildIndexes(files, []); // no categories registered
		const tree = buildTagTree({
			categories: [],
			forward: idx.forward,
			reverse: idx.reverse,
			universeTags: ["#legacy"],
			showUncategorized: true,
		});
		expect(tree).toHaveLength(1);
		expect(tree[0].label).toBe("Uncategorized");
		expect(tree[0].children.map((c) => c.tag)).toEqual(["legacy"]);
	});
});
