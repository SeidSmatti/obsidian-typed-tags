import { describe, it, expect } from "vitest";
import { buildTagTree } from "../../src/lib/tagTree";

function mapFrom(obj: Record<string, string[]>): Map<string, Set<string>> {
	const m = new Map<string, Set<string>>();
	for (const [k, v] of Object.entries(obj)) m.set(k, new Set(v));
	return m;
}

describe("buildTagTree", () => {
	it("renders empty when no categories and showUncategorized is off", () => {
		const t = buildTagTree({
			categories: [],
			forward: new Map(),
			reverse: new Map(),
			universeTags: ["#a", "#b"],
			showUncategorized: false,
		});
		expect(t).toEqual([]);
	});

	it("renders categories in the given order with sorted tags", () => {
		const t = buildTagTree({
			categories: ["People", "Companies"],
			forward: mapFrom({ People: ["JohnDoe", "JaneDoe"], Companies: ["Acme"] }),
			reverse: mapFrom({ JohnDoe: ["People"], JaneDoe: ["People"], Acme: ["Companies"] }),
			universeTags: ["#JohnDoe", "#JaneDoe", "#Acme"],
			showUncategorized: false,
		});
		expect(t.map((n) => n.label)).toEqual(["People", "Companies"]);
		expect(t[0].children.map((c) => c.tag)).toEqual(["JaneDoe", "JohnDoe"]);
	});

	it("surfaces multi-category tag under each of its categories", () => {
		const t = buildTagTree({
			categories: ["Food", "Companies"],
			forward: mapFrom({ Food: ["apple"], Companies: ["apple"] }),
			reverse: mapFrom({ apple: ["Food", "Companies"] }),
			universeTags: ["#apple"],
			showUncategorized: false,
		});
		expect(t[0].children.map((c) => c.tag)).toEqual(["apple"]);
		expect(t[1].children.map((c) => c.tag)).toEqual(["apple"]);
	});

	it("appends Uncategorized root when universe has unmapped tags", () => {
		const t = buildTagTree({
			categories: ["People"],
			forward: mapFrom({ People: ["JohnDoe"] }),
			reverse: mapFrom({ JohnDoe: ["People"] }),
			universeTags: ["#JohnDoe", "#project", "#inbox"],
			showUncategorized: true,
		});
		expect(t.map((n) => n.label)).toEqual(["People", "Uncategorized"]);
		expect(t[1].children.map((c) => c.tag)).toEqual(["inbox", "project"]);
	});

	it("deduplicates universe tags with and without leading hash", () => {
		const t = buildTagTree({
			categories: [],
			forward: new Map(),
			reverse: new Map(),
			universeTags: ["#dup", "dup", "#other"],
			showUncategorized: true,
		});
		expect(t[0].children.map((c) => c.tag)).toEqual(["dup", "other"]);
	});

	it("omits Uncategorized root when showUncategorized is false", () => {
		const t = buildTagTree({
			categories: ["People"],
			forward: new Map(),
			reverse: new Map(),
			universeTags: ["#x"],
			showUncategorized: false,
		});
		expect(t.map((n) => n.label)).toEqual(["People"]);
	});
});
