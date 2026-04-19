import { describe, it, expect } from "vitest";
import {
	detectFrontmatter,
	findTopLevelKey,
	rewriteFrontmatterKey,
} from "../../src/lib/frontmatterText";

describe("detectFrontmatter", () => {
	it("returns null when no frontmatter", () => {
		expect(detectFrontmatter("just body\n")).toBeNull();
	});

	it("detects an empty block", () => {
		const t = "---\n---\nbody\n";
		const b = detectFrontmatter(t);
		expect(b).not.toBeNull();
		expect(b!.startLine).toBe(0);
		expect(b!.endLine).toBe(1);
	});

	it("detects a block with content", () => {
		const t = "---\nPeople: [a, b]\nLocations: x\n---\nbody";
		const b = detectFrontmatter(t)!;
		expect(b.startLine).toBe(0);
		expect(b.endLine).toBe(3);
	});

	it("returns null when opening fence missing", () => {
		expect(detectFrontmatter("People: x\n---\n")).toBeNull();
	});

	it("returns null when opening fence has no closing fence", () => {
		expect(detectFrontmatter("---\nPeople: x\nbody\n")).toBeNull();
	});

	it("returns null on empty input", () => {
		expect(detectFrontmatter("")).toBeNull();
	});
});

describe("findTopLevelKey", () => {
	it("finds a scalar key", () => {
		const t = "---\nPeople: JohnDoe\n---\n";
		const b = detectFrontmatter(t)!;
		const k = findTopLevelKey(b, "People")!;
		expect(k.indent).toBe("");
		expect(k.rawKey).toBe("People");
		expect(k.suffix).toBe(" JohnDoe");
	});

	it("ignores nested keys at deeper indent", () => {
		const t = "---\nOuter:\n  People: nested\n---\n";
		const b = detectFrontmatter(t)!;
		expect(findTopLevelKey(b, "People")).toBeNull();
		expect(findTopLevelKey(b, "Outer")).not.toBeNull();
	});

	it("returns null when key is missing", () => {
		const t = "---\nOther: x\n---\n";
		const b = detectFrontmatter(t)!;
		expect(findTopLevelKey(b, "People")).toBeNull();
	});
});

describe("rewriteFrontmatterKey", () => {
	it("returns no-frontmatter when none", () => {
		const r = rewriteFrontmatterKey("body\n", "People", "Contacts");
		expect(r.status).toBe("no-frontmatter");
		expect(r.changed).toBe(false);
	});

	it("returns no-key when key absent", () => {
		const t = "---\nOther: x\n---\nbody";
		expect(rewriteFrontmatterKey(t, "People", "Contacts").status).toBe("no-key");
	});

	it("renames a scalar key without touching value formatting", () => {
		const t = "---\nPeople: JohnDoe\nOther: y\n---\nbody";
		const r = rewriteFrontmatterKey(t, "People", "Contacts");
		expect(r.status).toBe("ok");
		expect(r.changed).toBe(true);
		expect(r.newText).toBe("---\nContacts: JohnDoe\nOther: y\n---\nbody");
	});

	it("renames a block-array key without touching the items", () => {
		const t = "---\nPeople:\n  - JohnDoe\n  - JaneDoe\n---\nbody";
		const r = rewriteFrontmatterKey(t, "People", "Contacts");
		expect(r.changed).toBe(true);
		expect(r.newText).toBe("---\nContacts:\n  - JohnDoe\n  - JaneDoe\n---\nbody");
	});

	it("returns collision when target key already present", () => {
		const t = "---\nPeople: a\nContacts: b\n---\n";
		const r = rewriteFrontmatterKey(t, "People", "Contacts");
		expect(r.status).toBe("collision");
		expect(r.changed).toBe(false);
		expect(r.newText).toBe(t);
	});

	it("from === to is a no-op", () => {
		const t = "---\nPeople: a\n---\n";
		const r = rewriteFrontmatterKey(t, "People", "People");
		expect(r.changed).toBe(false);
		expect(r.newText).toBe(t);
	});

	it("preserves indentation, comments, blank lines, and trailing whitespace on the suffix", () => {
		const t = "---\nPeople:   JohnDoe   # the lead\n---\n";
		const r = rewriteFrontmatterKey(t, "People", "Contacts");
		expect(r.newText).toBe("---\nContacts:   JohnDoe   # the lead\n---\n");
	});

	it("round-trips: rewrite then back", () => {
		const t = "---\nPeople:\n  - JohnDoe\n  - JaneDoe\nUnrelated: x\n---\nbody\n";
		const fwd = rewriteFrontmatterKey(t, "People", "Contacts");
		const back = rewriteFrontmatterKey(fwd.newText, "Contacts", "People");
		expect(back.newText).toBe(t);
	});
});
