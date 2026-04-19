import { describe, it, expect, vi } from "vitest";
import { CategoryRegistry } from "../../src/categoryRegistry";
import { EventBus } from "../../src/lib/events";
import { PropertyTypeBinder } from "../../src/propertyTypeBinder";

function makeApp(existingTypes: Record<string, string> = {}) {
	const types = new Map(Object.entries(existingTypes));
	const setType = vi.fn((key: string, type: string) => {
		types.set(key, type);
	});
	const getAssignedType = vi.fn((key: string) => types.get(key) ?? null);
	const app = {
		metadataTypeManager: { setType, getAssignedType },
	};
	return { app, setType, getAssignedType, types };
}

describe("PropertyTypeBinder", () => {
	it("registers each category as 'tags' on install", () => {
		const { app, setType } = makeApp();
		const bus = new EventBus();
		const reg = new CategoryRegistry(["People", "Companies"], bus);
		const binder = new PropertyTypeBinder(app as never, reg, bus);
		binder.install();
		expect(setType).toHaveBeenCalledWith("People", "tags");
		expect(setType).toHaveBeenCalledWith("Companies", "tags");
	});

	it("re-applies when categories are added", () => {
		const { app, setType } = makeApp();
		const bus = new EventBus();
		const reg = new CategoryRegistry([], bus);
		const binder = new PropertyTypeBinder(app as never, reg, bus);
		binder.install();
		setType.mockClear();
		reg.add("Locations");
		expect(setType).toHaveBeenCalledWith("Locations", "tags");
	});

	it("restores original types on uninstall", () => {
		const { app, setType } = makeApp({ People: "text" });
		const bus = new EventBus();
		const reg = new CategoryRegistry(["People"], bus);
		const binder = new PropertyTypeBinder(app as never, reg, bus);
		binder.install();
		expect(setType).toHaveBeenLastCalledWith("People", "tags");
		binder.uninstall();
		expect(setType).toHaveBeenLastCalledWith("People", "text");
	});

	it("does nothing when metadataTypeManager is absent", () => {
		const bus = new EventBus();
		const reg = new CategoryRegistry(["People"], bus);
		const binder = new PropertyTypeBinder({} as never, reg, bus);
		expect(() => binder.install()).not.toThrow();
		expect(() => binder.uninstall()).not.toThrow();
	});

	it("leaves user-removed categories at 'tags' when no prior type existed", () => {
		const { app, setType } = makeApp();
		const bus = new EventBus();
		const reg = new CategoryRegistry(["People"], bus);
		const binder = new PropertyTypeBinder(app as never, reg, bus);
		binder.install();
		setType.mockClear();
		reg.remove("People");
		expect(setType).not.toHaveBeenCalled();
	});
});
