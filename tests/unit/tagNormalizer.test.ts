import { describe, it, expect } from "vitest";
import { normalize, normalizeAll } from "../../src/lib/tagNormalizer";

describe("normalize", () => {
	it("strips a single leading hash", () => {
		expect(normalize("#JohnDoe")).toBe("JohnDoe");
	});

	it("strips leading hash then trims", () => {
		expect(normalize("  #JohnDoe  ")).toBe("JohnDoe");
		expect(normalize("#  JohnDoe  ")).toBe("JohnDoe");
	});

	it("leaves strings without leading hash alone", () => {
		expect(normalize("JohnDoe")).toBe("JohnDoe");
	});

	it("trims whitespace-only strings to null", () => {
		expect(normalize("   ")).toBeNull();
		expect(normalize("#   ")).toBeNull();
	});

	it("rejects empty strings", () => {
		expect(normalize("")).toBeNull();
		expect(normalize("#")).toBeNull();
	});

	it("rejects non-string input", () => {
		expect(normalize(null)).toBeNull();
		expect(normalize(undefined)).toBeNull();
		expect(normalize(42)).toBeNull();
		expect(normalize({})).toBeNull();
	});

	it("preserves Unicode", () => {
		expect(normalize("#日本語")).toBe("日本語");
		expect(normalize("café")).toBe("café");
		expect(normalize("#🌍")).toBe("🌍");
	});

	it("does not strip multiple leading hashes (only one)", () => {
		expect(normalize("##nested")).toBe("#nested");
	});
});

describe("normalizeAll", () => {
	it("maps and filters nulls", () => {
		expect(normalizeAll(["#a", "", "  ", "b", null, 3, "c"])).toEqual(["a", "b", "c"]);
	});

	it("deduplicates in a stable order", () => {
		expect(normalizeAll(["#a", "a", "#a ", "b", "a"])).toEqual(["a", "b"]);
	});

	it("preserves Unicode in array form", () => {
		expect(normalizeAll(["#日本語", "café"])).toEqual(["日本語", "café"]);
	});
});
