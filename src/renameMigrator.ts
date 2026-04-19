import { App, Modal, Notice, Setting } from "obsidian";
import {
	RewriteStatus,
	rewriteFrontmatterKey,
} from "./lib/frontmatterText";
import { CategoryRegistry } from "./categoryRegistry";
import { IndexEngine } from "./indexEngine";
import { PersistedState } from "./lib/persistence";

export interface RenameDryRunFileResult {
	path: string;
	status: RewriteStatus;
	beforeLine?: string;
	afterLine?: string;
}

export interface RenameDryRun {
	from: string;
	to: string;
	scanned: number;
	willChange: number;
	collisions: number;
	missing: number;
	files: RenameDryRunFileResult[];
}

export class RenameMigrator {
	constructor(
		private readonly app: App,
		private readonly registry: CategoryRegistry,
		private readonly index: IndexEngine,
		private readonly persisted: PersistedState,
	) {}

	async dryRun(from: string, to: string): Promise<RenameDryRun> {
		const files = this.app.vault.getMarkdownFiles();
		const out: RenameDryRunFileResult[] = [];
		let willChange = 0;
		let collisions = 0;
		let missing = 0;
		for (const file of files) {
			const text = await this.app.vault.cachedRead(file);
			const result = rewriteFrontmatterKey(text, from, to);
			if (result.status === "ok" && result.changed) {
				willChange++;
				const beforeLines = text.split("\n");
				const afterLines = result.newText.split("\n");
				const diffIdx = beforeLines.findIndex((line, i) => line !== afterLines[i]);
				out.push({
					path: file.path,
					status: "ok",
					beforeLine: diffIdx >= 0 ? beforeLines[diffIdx] : undefined,
					afterLine: diffIdx >= 0 ? afterLines[diffIdx] : undefined,
				});
			} else if (result.status === "collision") {
				collisions++;
				out.push({ path: file.path, status: "collision" });
			} else if (result.status === "no-key" || result.status === "no-frontmatter") {
				missing++;
			}
		}
		return { from, to, scanned: files.length, willChange, collisions, missing, files: out };
	}

	async execute(plan: RenameDryRun): Promise<{ rewritten: number; failed: number }> {
		const map = new Map<string, RenameDryRunFileResult>();
		for (const f of plan.files) map.set(f.path, f);
		let rewritten = 0;
		let failed = 0;
		for (const file of this.app.vault.getMarkdownFiles()) {
			const planned = map.get(file.path);
			if (!planned || planned.status !== "ok") continue;
			try {
				await this.app.vault.process(file, (data) => {
					const r = rewriteFrontmatterKey(data, plan.from, plan.to);
					return r.status === "ok" && r.changed ? r.newText : data;
				});
				rewritten++;
			} catch (err) {
				failed++;
				console.error(`[typed-tags] rename failed for ${file.path}:`, err);
			}
		}
		this.persisted.categoryRenames.push({
			from: plan.from,
			to: plan.to,
			at: new Date().toISOString(),
		});
		try {
			this.registry.rename(plan.from, plan.to);
		} catch (e) {
			// If the registry throws (e.g. caller already renamed), the rewrite still completed safely.
			console.warn("[typed-tags] registry rename after vault rewrite:", e);
		}
		this.index.rebuildFull();
		return { rewritten, failed };
	}
}

export class RenameMigrationModal extends Modal {
	constructor(
		app: App,
		private readonly migrator: RenameMigrator,
		private readonly from: string,
		private readonly to: string,
		private readonly onComplete: () => void,
	) {
		super(app);
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: `Rename "${this.from}" → "${this.to}"` });
		const status = contentEl.createEl("p", { text: "Computing dry-run…" });

		const plan = await this.migrator.dryRun(this.from, this.to);
		status.setText(
			`Scanned ${plan.scanned} notes. ${plan.willChange} will change, ${plan.collisions} have collisions and will be skipped, ${plan.missing} have no matching key.`,
		);

		if (plan.collisions > 0) {
			const note = contentEl.createEl("p", { cls: "mod-warning" });
			note.setText(
				`Collisions: ${plan.collisions} notes already contain a "${this.to}" key. Those files will be left unchanged so no data is lost. Resolve them by hand if needed.`,
			);
		}

		contentEl.createEl("p", {
			text: "Preview (first 10 changes):",
			cls: "typed-tags-rename-header",
		});
		const list = contentEl.createEl("div", { cls: "typed-tags-rename-preview" });
		for (const entry of plan.files.slice(0, 10)) {
			const row = list.createEl("div", { cls: "typed-tags-rename-row" });
			row.createEl("div", { text: entry.path, cls: "typed-tags-rename-path" });
			if (entry.status === "ok") {
				row.createEl("div", { text: `- ${entry.beforeLine ?? ""}`, cls: "typed-tags-rename-before" });
				row.createEl("div", { text: `+ ${entry.afterLine ?? ""}`, cls: "typed-tags-rename-after" });
			} else {
				row.createEl("div", { text: `(${entry.status})`, cls: "typed-tags-rename-status" });
			}
		}

		new Setting(contentEl)
			.addButton((b) =>
				b.setButtonText("Cancel").onClick(() => this.close()),
			)
			.addButton((b) =>
				b
					.setButtonText(`Rewrite ${plan.willChange} notes`)
					.setCta()
					.setDisabled(plan.willChange === 0)
					.onClick(async () => {
						const result = await this.migrator.execute(plan);
						new Notice(
							`Rename complete: ${result.rewritten} notes rewritten, ${result.failed} failures.`,
						);
						this.onComplete();
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
