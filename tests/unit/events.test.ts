import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../../src/lib/events";

describe("EventBus", () => {
	it("delivers emitted events to subscribers", () => {
		const bus = new EventBus();
		const spy = vi.fn();
		bus.on("typed-tags:registry-changed", spy);
		bus.emit("typed-tags:registry-changed", { categories: ["People"] });
		expect(spy).toHaveBeenCalledWith({ categories: ["People"] });
	});

	it("unsubscribes via returned disposer", () => {
		const bus = new EventBus();
		const spy = vi.fn();
		const off = bus.on("typed-tags:index-updated", spy);
		off();
		bus.emit("typed-tags:index-updated", { changedTags: [] });
		expect(spy).not.toHaveBeenCalled();
	});

	it("clear drops all listeners", () => {
		const bus = new EventBus();
		const spy = vi.fn();
		bus.on("typed-tags:index-updated", spy);
		bus.clear();
		bus.emit("typed-tags:index-updated", { changedTags: ["x"] });
		expect(spy).not.toHaveBeenCalled();
	});
});
