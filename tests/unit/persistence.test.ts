import { describe, it, expect } from "vitest";
import { defaultState, validate, PersistedStateError, PERSISTED_SCHEMA_VERSION } from "../../src/lib/persistence";

describe("persistence.defaultState", () => {
	it("returns a fresh v1 state with empty indexes", () => {
		const s = defaultState();
		expect(s.version).toBe(PERSISTED_SCHEMA_VERSION);
		expect(s.categories).toEqual([]);
		expect(s.indexCache).toEqual({ hash: "", forward: {}, reverse: {} });
		expect(s.settings).toEqual({ restoreNativeTagPane: false, showUncategorized: true });
	});
});

describe("persistence.validate", () => {
	it("returns default state for null and undefined", () => {
		expect(validate(null)).toEqual(defaultState());
		expect(validate(undefined)).toEqual(defaultState());
	});

	it("rejects non-object input", () => {
		expect(() => validate("oops")).toThrow(PersistedStateError);
		expect(() => validate(42)).toThrow(PersistedStateError);
	});

	it("rejects unknown schema versions", () => {
		expect(() => validate({ version: 99 })).toThrow(/version/);
	});

	it("rejects non-string-array categories", () => {
		const bad = {
			version: 1,
			categories: ["ok", 3],
			categoryRenames: [],
			indexCache: { hash: "", forward: {}, reverse: {} },
			settings: {},
		};
		expect(() => validate(bad)).toThrow(/categories/);
	});

	it("round-trips a well-formed state", () => {
		const input = {
			version: 1,
			categories: ["People", "Companies"],
			categoryRenames: [{ from: "a", to: "b", at: "2026-04-19T00:00:00Z" }],
			indexCache: {
				hash: "abc",
				forward: { People: ["John"] },
				reverse: { John: ["People"] },
			},
			settings: { restoreNativeTagPane: true, showUncategorized: false },
		};
		expect(validate(input)).toEqual(input);
	});

	it("fills missing settings fields with defaults", () => {
		const v = validate({
			version: 1,
			categories: [],
			categoryRenames: [],
			indexCache: { hash: "", forward: {}, reverse: {} },
			settings: { restoreNativeTagPane: true },
		});
		expect(v.settings.restoreNativeTagPane).toBe(true);
		expect(v.settings.showUncategorized).toBe(true);
	});

	it("rejects malformed indexCache values", () => {
		expect(() =>
			validate({
				version: 1,
				categories: [],
				categoryRenames: [],
				indexCache: { hash: "x", forward: { People: "not-an-array" }, reverse: {} },
				settings: {},
			}),
		).toThrow(/forward/);
	});

	it("rejects malformed renames", () => {
		expect(() =>
			validate({
				version: 1,
				categories: [],
				categoryRenames: [{ from: "a", to: 3, at: "x" }],
				indexCache: { hash: "", forward: {}, reverse: {} },
				settings: {},
			}),
		).toThrow(/categoryRenames/);
	});
});
