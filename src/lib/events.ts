export type EventMap = {
	"typed-tags:index-updated": { changedTags: readonly string[] };
	"typed-tags:registry-changed": { categories: readonly string[] };
};

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

export class EventBus {
	private listeners = new Map<keyof EventMap, Set<Listener<keyof EventMap>>>();

	on<K extends keyof EventMap>(event: K, listener: Listener<K>): () => void {
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		const stored = listener as Listener<keyof EventMap>;
		set.add(stored);
		return () => set.delete(stored);
	}

	emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
		const set = this.listeners.get(event);
		if (!set) return;
		for (const listener of set) {
			(listener as Listener<K>)(payload);
		}
	}

	clear(): void {
		this.listeners.clear();
	}
}
