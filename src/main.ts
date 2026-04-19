import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { CategoryRegistry } from "./categoryRegistry";
import { IndexEngine } from "./indexEngine";
import { MetadataMirror } from "./metadataMirror";
import { PropertyTypeBinder } from "./propertyTypeBinder";
import { EventBus } from "./lib/events";
import {
	PersistedState,
	PersistedStateError,
	defaultState,
	validate,
} from "./lib/persistence";
import { TypedTagsSettingTab } from "./settingsTab";
import {
	NATIVE_TAG_VIEW_TYPE,
	TYPED_TAGS_VIEW_TYPE,
	TypedTagsPaneView,
} from "./tagPaneView";

type SidebarSide = "left" | "right";

export default class TypedTagsPlugin extends Plugin {
	bus!: EventBus;
	registry!: CategoryRegistry;
	persisted!: PersistedState;
	indexEngine!: IndexEngine;
	mirror!: MetadataMirror;
	propertyBinder!: PropertyTypeBinder;
	private nativeTagLocationAtLoad: SidebarSide | null = null;

	async onload(): Promise<void> {
		console.debug("[typed-tags] onload");

		this.bus = new EventBus();
		this.persisted = await this.loadState();
		this.registry = new CategoryRegistry(this.persisted.categories, this.bus);

		this.register(
			this.bus.on("typed-tags:registry-changed", ({ categories }) => {
				this.persisted.categories = categories.slice();
				void this.saveState();
			}),
		);

		this.indexEngine = new IndexEngine(this.app, this.registry, this.bus, this.persisted);
		this.mirror = new MetadataMirror(this.app, this.indexEngine);
		this.propertyBinder = new PropertyTypeBinder(this.app, this.registry, this.bus);

		this.registerView(
			TYPED_TAGS_VIEW_TYPE,
			(leaf: WorkspaceLeaf) =>
				new TypedTagsPaneView(leaf, {
					registry: this.registry,
					indexEngine: this.indexEngine,
					bus: this.bus,
					settings: this.persisted.settings,
					openTagSearch: (tag) => this.openTagSearch(tag),
					universeTags: () => Object.keys(this.app.metadataCache.getTags?.() ?? {}),
					rebuildIndex: () => this.indexEngine.rebuildFull(),
				}),
		);

		this.app.workspace.onLayoutReady(() => {
			this.indexEngine.init();
			this.mirror.install();
			this.propertyBinder.install();
			this.installTagPane();
		});

		this.registerMarkdownPostProcessor((el) => this.pillifyReadingView(el));

		this.register(
			this.bus.on("typed-tags:index-updated", () => {
				void this.saveState();
			}),
		);

		this.addSettingTab(new TypedTagsSettingTab(this.app, this));
	}

	onunload(): void {
		console.debug("[typed-tags] onunload");
		this.app.workspace.detachLeavesOfType(TYPED_TAGS_VIEW_TYPE);
		this.propertyBinder?.uninstall();
		this.mirror?.uninstall();
		this.indexEngine?.dispose();
		this.bus?.clear();
	}

	private installTagPane(): void {
		if (this.persisted.settings.restoreNativeTagPane) return;
		this.nativeTagLocationAtLoad = this.locateNativeTagLeaf();
		this.app.workspace.detachLeavesOfType(NATIVE_TAG_VIEW_TYPE);
		const side: SidebarSide = this.nativeTagLocationAtLoad ?? "left";
		const leaf =
			side === "right"
				? this.app.workspace.getRightLeaf(false)
				: this.app.workspace.getLeftLeaf(false);
		if (!leaf) return;
		void leaf.setViewState({ type: TYPED_TAGS_VIEW_TYPE, active: false });
	}

	private locateNativeTagLeaf(): SidebarSide | null {
		const leaves = this.app.workspace.getLeavesOfType(NATIVE_TAG_VIEW_TYPE);
		for (const leaf of leaves) {
			const root = leaf.getRoot();
			const rootAny = root as unknown as { side?: string };
			if (rootAny.side === "left" || rootAny.side === "right") return rootAny.side;
		}
		return null;
	}

	private pillifyReadingView(root: HTMLElement): void {
		const categories = new Set(this.registry.list());
		if (categories.size === 0) return;
		const rows = root.querySelectorAll<HTMLElement>(".metadata-property");
		rows.forEach((row) => {
			const key = row.getAttribute("data-property-key");
			if (!key || !categories.has(key)) return;
			row.classList.add("typed-tags-pillified");
			const values = row.querySelectorAll<HTMLElement>(".multi-select-pill, .metadata-input-longtext, .metadata-input-text");
			values.forEach((node) => {
				node.classList.add("typed-tags-pill");
				node.addEventListener("click", (evt) => {
					const label = (node.textContent ?? "").trim();
					if (!label) return;
					evt.stopPropagation();
					this.openTagSearch(label);
				});
			});
		});
	}

	private openTagSearch(tag: string): void {
		const clean = tag.startsWith("#") ? tag.slice(1) : tag;
		const search = (this.app as unknown as {
			internalPlugins?: { getPluginById(id: string): { instance?: { openGlobalSearch(q: string): void } } | null };
		}).internalPlugins?.getPluginById("global-search");
		if (search?.instance?.openGlobalSearch) {
			search.instance.openGlobalSearch(`tag:#${clean}`);
		}
	}

	private async loadState(): Promise<PersistedState> {
		try {
			const raw = await this.loadData();
			return validate(raw);
		} catch (e) {
			if (e instanceof PersistedStateError) {
				console.error("[typed-tags] failed to load data.json:", e);
				new Notice(
					`Typed Tags: could not load data.json (${e.message}). Starting with defaults; original file not overwritten until you save.`,
				);
				return defaultState();
			}
			throw e;
		}
	}

	async saveState(): Promise<void> {
		await this.saveData(this.persisted);
	}
}
