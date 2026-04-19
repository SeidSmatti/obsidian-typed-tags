import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../../src/lib/events";
import { CategoryRegistry, CategoryRegistryError, normalizeCategoryKey } from "../../src/categoryRegistry";

function fresh(initial: readonly string[] = []) {
	const bus = new EventBus();
	const reg = new CategoryRegistry(initial, bus);
	return { bus, reg };
}

describe("normalizeCategoryKey", () => {
	it("trims whitespace and rejects empty", () => {
		expect(normalizeCategoryKey("  People  ")).toBe("People");
		expect(normalizeCategoryKey("")).toBeNull();
		expect(normalizeCategoryKey("   ")).toBeNull();
		expect(normalizeCategoryKey("\t\n")).toBeNull();
	});

	it("preserves internal whitespace and unicode", () => {
		expect(normalizeCategoryKey("Team Members")).toBe("Team Members");
		expect(normalizeCategoryKey("人物")).toBe("人物");
	});
});

describe("CategoryRegistry", () => {
	it("lists initial categories as a copy", () => {
		const { reg } = fresh(["A", "B"]);
		const out = reg.list();
		expect(out).toEqual(["A", "B"]);
		(out as string[]).push("mutated");
		expect(reg.list()).toEqual(["A", "B"]);
	});

	it("adds a category and emits registry-changed", () => {
		const { reg, bus } = fresh();
		const spy = vi.fn();
		bus.on("typed-tags:registry-changed", spy);
		reg.add("People");
		expect(reg.list()).toEqual(["People"]);
		expect(spy).toHaveBeenCalledWith({ categories: ["People"] });
	});

	it("trims whitespace on add", () => {
		const { reg } = fresh();
		expect(reg.add("  Locations  ")).toBe("Locations");
		expect(reg.list()).toEqual(["Locations"]);
	});

	it("rejects empty and whitespace-only add", () => {
		const { reg } = fresh();
		expect(() => reg.add("")).toThrow(CategoryRegistryError);
		expect(() => reg.add("   ")).toThrow(CategoryRegistryError);
	});

	it("rejects duplicate add", () => {
		const { reg } = fresh(["People"]);
		expect(() => reg.add("People")).toThrow(/already exists/);
	});

	it("removes an existing category", () => {
		const { reg, bus } = fresh(["A", "B", "C"]);
		const spy = vi.fn();
		bus.on("typed-tags:registry-changed", spy);
		reg.remove("B");
		expect(reg.list()).toEqual(["A", "C"]);
		expect(spy).toHaveBeenCalledOnce();
	});

	it("rejects remove of missing category", () => {
		const { reg } = fresh(["A"]);
		expect(() => reg.remove("X")).toThrow(/not found/);
	});

	it("renames in place without reordering", () => {
		const { reg } = fresh(["A", "B", "C"]);
		expect(reg.rename("B", "Banana")).toBe("Banana");
		expect(reg.list()).toEqual(["A", "Banana", "C"]);
	});

	it("rename to same name is a no-op", () => {
		const { reg, bus } = fresh(["A"]);
		const spy = vi.fn();
		bus.on("typed-tags:registry-changed", spy);
		reg.rename("A", "A");
		expect(reg.list()).toEqual(["A"]);
		expect(spy).not.toHaveBeenCalled();
	});

	it("rejects rename to empty", () => {
		const { reg } = fresh(["A"]);
		expect(() => reg.rename("A", "   ")).toThrow(CategoryRegistryError);
	});

	it("rejects rename to existing key", () => {
		const { reg } = fresh(["A", "B"]);
		expect(() => reg.rename("A", "B")).toThrow(/already exists/);
	});

	it("rejects rename of missing category", () => {
		const { reg } = fresh(["A"]);
		expect(() => reg.rename("X", "Y")).toThrow(/not found/);
	});

	it("has returns correct membership", () => {
		const { reg } = fresh(["A"]);
		expect(reg.has("A")).toBe(true);
		expect(reg.has("B")).toBe(false);
	});

	it("replaceAll overwrites and emits", () => {
		const { reg, bus } = fresh(["A"]);
		const spy = vi.fn();
		bus.on("typed-tags:registry-changed", spy);
		reg.replaceAll(["X", "Y"]);
		expect(reg.list()).toEqual(["X", "Y"]);
		expect(spy).toHaveBeenCalledWith({ categories: ["X", "Y"] });
	});
});
