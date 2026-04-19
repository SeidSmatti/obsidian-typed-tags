import { describe, it, expect } from "vitest";
import { buildIndexes, FileEntry } from "../../src/lib/frontmatter";

function makeFixture(count: number): FileEntry[] {
	const files: FileEntry[] = [];
	for (let i = 0; i < count; i++) {
		files.push({
			path: `note-${i}.md`,
			frontmatter: {
				People: [`Person${i % 7}`, `Person${(i + 1) % 7}`],
				Companies: i % 3 === 0 ? [`Acme${i % 11}`] : undefined,
				Locations: i % 5 === 0 ? `Place${i % 13}` : undefined,
			},
		});
	}
	return files;
}

describe("buildIndexes performance", () => {
	it("builds 20-note fixture in <50ms", () => {
		const files = makeFixture(20);
		const start = performance.now();
		const idx = buildIndexes(files, ["People", "Companies", "Locations"]);
		const elapsed = performance.now() - start;
		expect(idx.forward.size).toBeGreaterThan(0);
		expect(elapsed).toBeLessThan(50);
	});

	it("builds 5000-note fixture in <500ms (NF1 target)", () => {
		const files = makeFixture(5000);
		const start = performance.now();
		const idx = buildIndexes(files, ["People", "Companies", "Locations"]);
		const elapsed = performance.now() - start;
		expect(idx.forward.size).toBeGreaterThan(0);
		expect(elapsed).toBeLessThan(500);
	});
});
