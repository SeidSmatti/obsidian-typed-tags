import { describe, it, expect } from "vitest";
import {
	applyIncrementalUpdate,
	buildIndexes,
	indexHash,
	normalizeValue,
	planRename,
	readTypedTags,
	serializeIndex,
	FileEntry,
} from "../../src/lib/frontmatter";

describe("normalizeValue", () => {
	it("handles scalar string", () => {
		expect(normalizeValue("JohnDoe")).toEqual(["JohnDoe"]);
		expect(normalizeValue("#JohnDoe")).toEqual(["JohnDoe"]);
	});

	it("handles array of strings", () => {
		expect(normalizeValue(["JohnDoe", "#JaneDoe", " "])).toEqual(["JohnDoe", "JaneDoe"]);
	});

	it("returns [] for missing, null, undefined, non-string", () => {
		expect(normalizeValue(null)).toEqual([]);
		expect(normalizeValue(undefined)).toEqual([]);
		expect(normalizeValue(42)).toEqual([]);
		expect(normalizeValue({})).toEqual([]);
	});

	it("dedupes array values", () => {
		expect(normalizeValue(["a", "#a", "a "])).toEqual(["a"]);
	});
});

describe("readTypedTags", () => {
	it("returns empty when frontmatter is null", () => {
		expect(readTypedTags(null, ["People"]).byCategory.size).toBe(0);
		expect(readTypedTags(undefined, ["People"]).byCategory.size).toBe(0);
	});

	it("only reads registered categories", () => {
		const fm = { People: ["JohnDoe"], Ignored: ["x"] };
		const out = readTypedTags(fm, ["People"]);
		expect(out.byCategory.get("People")).toEqual(["JohnDoe"]);
		expect(out.byCategory.has("Ignored")).toBe(false);
	});

	it("skips empty category values", () => {
		const fm = { People: [], Locations: "  " };
		const out = readTypedTags(fm, ["People", "Locations"]);
		expect(out.byCategory.size).toBe(0);
	});
});

describe("buildIndexes", () => {
	const files: FileEntry[] = [
		{ path: "a.md", frontmatter: { People: ["JohnDoe", "JaneDoe"] } },
		{ path: "b.md", frontmatter: { People: "JohnDoe", Companies: ["Acme"] } },
		{ path: "c.md", frontmatter: { People: ["apple"], Companies: "#apple" } },
		{ path: "d.md", frontmatter: null },
		{ path: "e.md", frontmatter: { Unrelated: "x" } },
	];

	it("produces correct forward index", () => {
		const idx = buildIndexes(files, ["People", "Companies"]);
		const ser = serializeIndex(idx);
		expect(ser.forward).toEqual({
			People: ["JaneDoe", "JohnDoe", "apple"],
			Companies: ["Acme", "apple"],
		});
	});

	it("produces correct reverse index including multi-category mapping", () => {
		const idx = buildIndexes(files, ["People", "Companies"]);
		const ser = serializeIndex(idx);
		expect(ser.reverse).toEqual({
			JohnDoe: ["People"],
			JaneDoe: ["People"],
			Acme: ["Companies"],
			apple: ["Companies", "People"],
		});
	});

	it("perFile map matches inputs", () => {
		const idx = buildIndexes(files, ["People", "Companies"]);
		expect(idx.perFile.get("a.md")!.byCategory.get("People")).toEqual(["JohnDoe", "JaneDoe"]);
		expect(idx.perFile.get("d.md")!.byCategory.size).toBe(0);
		expect(idx.perFile.get("e.md")!.byCategory.size).toBe(0);
	});

	it("empty categories list yields empty indexes", () => {
		const idx = buildIndexes(files, []);
		expect(serializeIndex(idx).forward).toEqual({});
		expect(serializeIndex(idx).reverse).toEqual({});
	});
});

describe("indexHash", () => {
	it("is stable across equivalent inputs regardless of order", () => {
		const fsA: FileEntry[] = [
			{ path: "a.md", frontmatter: { People: ["X", "Y"] } },
			{ path: "b.md", frontmatter: { People: "Z" } },
		];
		const fsB: FileEntry[] = [
			{ path: "b.md", frontmatter: { People: ["Z"] } },
			{ path: "a.md", frontmatter: { People: ["Y", "X"] } },
		];
		expect(indexHash(fsA, ["People"])).toBe(indexHash(fsB, ["People"]));
	});

	it("changes when content changes", () => {
		const fs1: FileEntry[] = [{ path: "a.md", frontmatter: { People: ["X"] } }];
		const fs2: FileEntry[] = [{ path: "a.md", frontmatter: { People: ["Y"] } }];
		expect(indexHash(fs1, ["People"])).not.toBe(indexHash(fs2, ["People"]));
	});

	it("changes when categories change", () => {
		const files: FileEntry[] = [{ path: "a.md", frontmatter: { People: ["X"] } }];
		expect(indexHash(files, ["People"])).not.toBe(indexHash(files, ["People", "Companies"]));
	});
});

describe("applyIncrementalUpdate", () => {
	it("removes a tag from the indexes when its only file no longer references it", () => {
		const idx = buildIndexes(
			[{ path: "a.md", frontmatter: { People: ["JohnDoe"] } }],
			["People"],
		);
		expect(idx.reverse.has("JohnDoe")).toBe(true);
		applyIncrementalUpdate(idx, "a.md", readTypedTags({}, ["People"]));
		expect(idx.reverse.has("JohnDoe")).toBe(false);
		expect(idx.forward.get("People")?.has("JohnDoe")).toBe(false);
	});

	it("keeps a tag in the indexes when another file still references it", () => {
		const idx = buildIndexes(
			[
				{ path: "a.md", frontmatter: { People: ["JohnDoe"] } },
				{ path: "b.md", frontmatter: { People: ["JohnDoe"] } },
			],
			["People"],
		);
		applyIncrementalUpdate(idx, "a.md", readTypedTags({}, ["People"]));
		expect(idx.reverse.get("JohnDoe")?.has("People")).toBe(true);
		expect(idx.forward.get("People")?.has("JohnDoe")).toBe(true);
	});

	it("adding a new tag to a file populates the forward and reverse indexes", () => {
		const idx = buildIndexes([], ["People"]);
		applyIncrementalUpdate(
			idx,
			"a.md",
			readTypedTags({ People: ["JaneDoe"] }, ["People"]),
		);
		expect(idx.forward.get("People")?.has("JaneDoe")).toBe(true);
		expect(idx.reverse.get("JaneDoe")?.has("People")).toBe(true);
	});

	it("replacing one tag with another updates both directions", () => {
		const idx = buildIndexes(
			[{ path: "a.md", frontmatter: { People: ["JohnDoe"] } }],
			["People"],
		);
		applyIncrementalUpdate(
			idx,
			"a.md",
			readTypedTags({ People: ["JaneDoe"] }, ["People"]),
		);
		expect(idx.reverse.has("JohnDoe")).toBe(false);
		expect(idx.forward.get("People")?.has("JaneDoe")).toBe(true);
	});
});

describe("planRename", () => {
	it("is a no-op when key is missing", () => {
		const plan = planRename({ Other: ["x"] }, "People", "Contacts");
		expect(plan.changed).toBe(false);
		expect(plan.reason).toBe("no-op-missing-key");
	});

	it("renames a scalar value and drops the old key", () => {
		const plan = planRename({ People: "JohnDoe" }, "People", "Contacts");
		expect(plan.changed).toBe(true);
		expect(plan.newFrontmatter).toEqual({ Contacts: ["JohnDoe"] });
	});

	it("renames an array value", () => {
		const plan = planRename({ People: ["JohnDoe", "#JaneDoe"] }, "People", "Contacts");
		expect(plan.changed).toBe(true);
		expect(plan.newFrontmatter).toEqual({ Contacts: ["JohnDoe", "JaneDoe"] });
	});

	it("merges with collision target, deduping", () => {
		const plan = planRename(
			{ People: ["JohnDoe", "JaneDoe"], Contacts: ["JohnDoe", "Alice"] },
			"People",
			"Contacts",
		);
		expect(plan.changed).toBe(true);
		expect(plan.reason).toBe("collision-merged");
		expect(plan.newFrontmatter).toEqual({ Contacts: ["JohnDoe", "Alice", "JaneDoe"] });
	});

	it("preserves unrelated frontmatter keys", () => {
		const plan = planRename(
			{ People: ["X"], title: "note", Unrelated: ["y"] },
			"People",
			"Contacts",
		);
		expect(plan.newFrontmatter).toEqual({ Contacts: ["X"], title: "note", Unrelated: ["y"] });
	});
});
