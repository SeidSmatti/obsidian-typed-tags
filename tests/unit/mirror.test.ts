import { describe, it, expect } from "vitest";
import { augmentCache, augmentTagUniverse, TagMirrorContext } from "../../src/lib/mirror";

function ctx(typed: Record<string, string[]>, all = [] as string[]): TagMirrorContext {
	return {
		categories: () => Object.keys(typed),
		typedTagsForPath: (p) => typed[p] ?? [],
		allFlatTags: () => (all.length ? all : Object.values(typed).flat()),
	};
}

describe("augmentCache", () => {
	it("returns null when cache is null", () => {
		expect(augmentCache(null, "a.md", ctx({}))).toBeNull();
	});

	it("is a no-op when no typed tags for path", () => {
		const cache = { frontmatter: { tags: ["native"] } };
		const out = augmentCache(cache, "a.md", ctx({}));
		expect(out).toBe(cache);
	});

	it("adds typed tags into empty frontmatter.tags", () => {
		const cache = {};
		const out = augmentCache(cache, "a.md", ctx({ "a.md": ["JohnDoe"] }));
		expect(out?.frontmatter?.tags).toEqual(["JohnDoe"]);
	});

	it("merges with existing array frontmatter.tags, deduping", () => {
		const cache = { frontmatter: { tags: ["native", "JohnDoe"] } };
		const out = augmentCache(cache, "a.md", ctx({ "a.md": ["JohnDoe", "JaneDoe"] }));
		expect(out?.frontmatter?.tags).toEqual(["native", "JohnDoe", "JaneDoe"]);
	});

	it("handles scalar string frontmatter.tags", () => {
		const cache = { frontmatter: { tags: "native, other" } };
		const out = augmentCache(cache, "a.md", ctx({ "a.md": ["JohnDoe"] }));
		expect(out?.frontmatter?.tags).toEqual(["native", "other", "JohnDoe"]);
	});

	it("also reads 'tag' singular key", () => {
		const cache = { frontmatter: { tag: "solo" } };
		const out = augmentCache(cache, "a.md", ctx({ "a.md": ["JohnDoe"] }));
		expect(out?.frontmatter?.tags).toEqual(["solo", "JohnDoe"]);
	});

	it("does not mutate the input cache", () => {
		const cache = { frontmatter: { tags: ["native"] } };
		const snapshot = JSON.parse(JSON.stringify(cache));
		augmentCache(cache, "a.md", ctx({ "a.md": ["JohnDoe"] }));
		expect(cache).toEqual(snapshot);
	});
});

describe("augmentTagUniverse", () => {
	it("merges native and typed tags with counts", () => {
		const native = { "#existing": 2 };
		const out = augmentTagUniverse(native, ctx({ "a.md": ["JohnDoe"] }, ["JohnDoe", "existing"]));
		expect(out["#JohnDoe"]).toBe(1);
		expect(out["#existing"]).toBe(3);
	});

	it("prefixes tags that don't already have #", () => {
		const out = augmentTagUniverse({}, ctx({}, ["Raw"]));
		expect(out["#Raw"]).toBe(1);
	});

	it("preserves already-prefixed tags", () => {
		const out = augmentTagUniverse({}, ctx({}, ["#Already"]));
		expect(out["#Already"]).toBe(1);
	});
});
