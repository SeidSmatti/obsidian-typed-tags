import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import type TypedTagsPlugin from "./main";
import { CategoryRegistryError } from "./categoryRegistry";
import { RenameMigrationModal, RenameMigrator } from "./renameMigrator";

class RenamePromptModal extends Modal {
	private value: string;

	constructor(
		app: App,
		private readonly from: string,
		private readonly onSubmit: (to: string) => void,
	) {
		super(app);
		this.value = from;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: `Rename category "${this.from}"` });
		contentEl.createEl("p", {
			text: "Enter the new key. The next step previews every change before any file is rewritten.",
			cls: "setting-item-description",
		});
		const input = contentEl.createEl("input", {
			type: "text",
			value: this.value,
			cls: "typed-tags-prompt-input",
		});
		input.addEventListener("input", () => {
			this.value = input.value;
		});
		input.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter") {
				evt.preventDefault();
				this.submit();
			}
			if (evt.key === "Escape") this.close();
		});
		new Setting(contentEl)
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((b) =>
				b.setButtonText("Continue").setCta().onClick(() => this.submit()),
			);
		window.setTimeout(() => input.focus(), 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private submit(): void {
		const trimmed = this.value.trim();
		if (trimmed === "") {
			new Notice("New category key must be non-empty.");
			return;
		}
		this.close();
		this.onSubmit(trimmed);
	}
}

export class TypedTagsSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: TypedTagsPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Categories").setHeading();
		containerEl.createEl("p", {
			text: "Register YAML property keys as tag containers. Values in these properties are indexed as flat tags grouped under the category name.",
			cls: "setting-item-description",
		});

		this.renderCategoryList(containerEl);
		this.renderAdd(containerEl);

		new Setting(containerEl).setName("Display").setHeading();

		new Setting(containerEl)
			.setName("Restore native tag pane")
			.setDesc("Skip registering the custom tag pane; use the built-in tag pane instead. Takes effect on next plugin load.")
			.addToggle((t) =>
				t.setValue(this.plugin.persisted.settings.restoreNativeTagPane).onChange(async (v) => {
					this.plugin.persisted.settings.restoreNativeTagPane = v;
					await this.plugin.saveState();
				}),
			);

		new Setting(containerEl)
			.setName("Show uncategorized bucket")
			.setDesc("Show a root in the custom tag pane for tags not mapped to any category.")
			.addToggle((t) =>
				t.setValue(this.plugin.persisted.settings.showUncategorized).onChange(async (v) => {
					this.plugin.persisted.settings.showUncategorized = v;
					await this.plugin.saveState();
				}),
			);
	}

	private renderCategoryList(parent: HTMLElement): void {
		const list = this.plugin.registry.list();
		if (list.length === 0) {
			parent.createEl("p", {
				text: "No categories yet. Add one below.",
				cls: "setting-item-description",
			});
			return;
		}
		for (const key of list) {
			new Setting(parent)
				.setName(key)
				.setDesc(`Property key "${key}" is treated as a tag container.`)
				.addButton((b) =>
					b
						.setButtonText("Rename")
						.setTooltip("Rename this category. Frontmatter migration will ship in v1; for now this renames the registry entry only.")
						.onClick(() => this.promptRename(key)),
				)
				.addButton((b) =>
					b
						.setButtonText("Remove")
						.setWarning()
						.setTooltip("Remove this category from the registry. Notes keep their frontmatter values.")
						.onClick(() => this.doRemove(key)),
				);
		}
	}

	private renderAdd(parent: HTMLElement): void {
		let pendingValue = "";
		let errorEl: HTMLElement | null = null;
		const showError = (msg: string | null) => {
			if (!errorEl) return;
			errorEl.setText(msg ?? "");
			errorEl.toggleClass("mod-warning", msg !== null);
		};
		new Setting(parent)
			.setName("Add category")
			.setDesc("Enter a YAML property key to register as a tag container.")
			.addText((t) => {
				t.setPlaceholder("People")
					.onChange((v) => {
						pendingValue = v;
						showError(null);
					});
			})
			.addButton((b) =>
				b
					.setButtonText("Add")
					.setCta()
					.onClick(async () => {
						try {
							this.plugin.registry.add(pendingValue);
							pendingValue = "";
							await this.plugin.saveState();
							this.display();
						} catch (e) {
							if (e instanceof CategoryRegistryError) {
								showError(e.message);
							} else {
								throw e;
							}
						}
					}),
			);
		errorEl = parent.createEl("div", { cls: "setting-item-description" });
	}

	private async doRemove(key: string): Promise<void> {
		try {
			this.plugin.registry.remove(key);
			await this.plugin.saveState();
			new Notice(`Removed category "${key}". Notes' frontmatter values are unchanged.`);
			this.display();
		} catch (e) {
			if (e instanceof CategoryRegistryError) {
				new Notice(e.message);
			} else {
				throw e;
			}
		}
	}

	private promptRename(from: string): void {
		new RenamePromptModal(this.app, from, (to) => {
			if (to === from) return;
			if (this.plugin.registry.has(to)) {
				new Notice(`Category "${to}" already exists. Pick a different target.`);
				return;
			}
			const migrator = new RenameMigrator(
				this.app,
				this.plugin.registry,
				this.plugin.indexEngine,
				this.plugin.persisted,
			);
			const modal = new RenameMigrationModal(this.app, migrator, from, to, () => {
				void this.plugin.saveState().then(() => this.display());
			});
			modal.open();
		}).open();
	}
}
