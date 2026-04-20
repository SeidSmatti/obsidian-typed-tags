import { ItemView, WorkspaceLeaf } from "obsidian";
import { CategoryRegistry } from "./categoryRegistry";
import { IndexEngine } from "./indexEngine";
import { EventBus } from "./lib/events";
import { PluginSettings } from "./lib/persistence";
import { TreeRoot, buildTagTree } from "./lib/tagTree";

export const TYPED_TAGS_VIEW_TYPE = "typed-tags-pane";
export const NATIVE_TAG_VIEW_TYPE = "tag";

export interface TagPaneDeps {
	registry: CategoryRegistry;
	indexEngine: IndexEngine;
	bus: EventBus;
	settings: PluginSettings;
	openTagSearch: (tag: string) => void;
	universeTags: () => readonly string[];
	rebuildIndex: () => void;
}

export class TypedTagsPaneView extends ItemView {
	private disposers: Array<() => void> = [];
	private collapsed = new Set<string>();

	constructor(leaf: WorkspaceLeaf, private readonly deps: TagPaneDeps) {
		super(leaf);
	}

	getViewType(): string {
		return TYPED_TAGS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Typed tags";
	}

	getIcon(): string {
		return "tag";
	}

	onOpen(): Promise<void> {
		this.disposers.push(this.deps.bus.on("typed-tags:index-updated", () => this.render()));
		this.disposers.push(this.deps.bus.on("typed-tags:registry-changed", () => this.render()));
		this.render();
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		for (const off of this.disposers) off();
		this.disposers = [];
		return Promise.resolve();
	}

	render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("typed-tags-pane");
		this.renderToolbar(container);
		const tree = this.buildTree();
		if (tree.length === 0) {
			container.createEl("p", {
				text: "No categories registered yet. Add one in the plugin settings.",
				cls: "typed-tags-empty",
			});
			return;
		}
		for (const root of tree) this.renderRoot(container, root);
	}

	private renderToolbar(parent: HTMLElement): void {
		const bar = parent.createDiv({ cls: "typed-tags-toolbar" });
		const refresh = bar.createEl("button", { cls: "typed-tags-refresh", text: "↻ refresh" });
		refresh.setAttr("aria-label", "Rebuild typed-tag index");
		refresh.addEventListener("click", () => {
			this.deps.rebuildIndex();
			this.render();
		});
	}

	private buildTree(): TreeRoot[] {
		const merged = new Set<string>(this.deps.indexEngine.getAllFlatTags());
		for (const tag of this.deps.universeTags()) {
			merged.add(tag.startsWith("#") ? tag.slice(1) : tag);
		}
		return buildTagTree({
			categories: this.deps.registry.list(),
			forward: this.deps.indexEngine.getForward(),
			reverse: this.deps.indexEngine.getReverse(),
			universeTags: Array.from(merged),
			showUncategorized: this.deps.settings.showUncategorized,
		});
	}

	private renderRoot(parent: HTMLElement, root: TreeRoot): void {
		const isCollapsed = this.collapsed.has(root.label);
		const rootEl = parent.createDiv({ cls: `typed-tags-root ${root.kind}` });
		const header = rootEl.createDiv({ cls: "typed-tags-root-header" });
		const chevron = header.createSpan({ cls: "typed-tags-chevron" });
		chevron.setText(isCollapsed ? "▸" : "▾");
		header.createSpan({ cls: "typed-tags-root-label", text: root.label });
		header.createSpan({
			cls: "typed-tags-root-count",
			text: ` (${root.children.length})`,
		});
		header.addEventListener("click", () => {
			if (isCollapsed) this.collapsed.delete(root.label);
			else this.collapsed.add(root.label);
			this.render();
		});
		if (isCollapsed) return;
		const list = rootEl.createDiv({ cls: "typed-tags-leaves" });
		for (const child of root.children) {
			const leafEl = list.createDiv({ cls: "typed-tags-leaf" });
			leafEl.setText(`#${child.tag}`);
			leafEl.addEventListener("click", (evt) => {
				evt.preventDefault();
				this.deps.openTagSearch(child.tag);
			});
		}
	}
}
