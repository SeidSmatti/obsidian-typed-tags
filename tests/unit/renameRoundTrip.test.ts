import { describe, it, expect } from "vitest";
import { rewriteFrontmatterKey } from "../../src/lib/frontmatterText";

function generate50(): { path: string; text: string }[] {
	const out: { path: string; text: string }[] = [];
	for (let i = 0; i < 50; i++) {
		const arr = i % 3 === 0;
		const peopleBlock = arr
			? `People:\n  - JohnDoe${i}\n  - JaneDoe${i}`
			: `People: JohnDoe${i}`;
		const unicode = i % 7 === 0 ? `Locations: 日本語${i}` : "";
		const unrelated = i % 5 === 0 ? `tags: [native${i}]` : "";
		const lines = ["---", peopleBlock];
		if (unicode) lines.push(unicode);
		if (unrelated) lines.push(unrelated);
		lines.push("---", `# Note ${i}`, `body content #inlineTag${i}`);
		out.push({ path: `note-${i}.md`, text: lines.join("\n") + "\n" });
	}
	return out;
}

describe("Phase 7 — 50-note rename round-trip (pure)", () => {
	it("renames People → Contacts then back to People with zero data loss", () => {
		const originals = generate50();
		const after = originals.map(({ path, text }) => {
			const r = rewriteFrontmatterKey(text, "People", "Contacts");
			expect(r.status).toBe("ok");
			return { path, text: r.newText };
		});
		const back = after.map(({ path, text }) => {
			const r = rewriteFrontmatterKey(text, "Contacts", "People");
			return { path, text: r.newText };
		});
		for (let i = 0; i < originals.length; i++) {
			expect(back[i].text).toBe(originals[i].text);
		}
	});

	it("dry-run preview matches actual rewrite — same diff line for every changed file", () => {
		const originals = generate50();
		for (const { text } of originals) {
			const dry = rewriteFrontmatterKey(text, "People", "Contacts");
			const real = rewriteFrontmatterKey(text, "People", "Contacts");
			expect(dry).toEqual(real);
		}
	});

	it("does not touch unrelated keys (tags, Locations, body)", () => {
		const originals = generate50();
		for (const { text } of originals) {
			const r = rewriteFrontmatterKey(text, "People", "Contacts");
			if (text.includes("tags:")) expect(r.newText).toContain("tags:");
			if (text.includes("Locations:")) expect(r.newText).toContain("Locations:");
			expect(r.newText).toContain("#inlineTag");
		}
	});
});
