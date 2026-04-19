import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_DIR = path.resolve(__dirname, "..", "test-vault");
const FIXTURE_DIR = path.join(VAULT_DIR, "seed");

const seeds = [
	{ file: "alice.md", frontmatter: { People: ["JohnDoe", "JaneDoe"], tags: ["friend"] }, body: "Meeting notes referencing #JohnDoe." },
	{ file: "acme.md", frontmatter: { Companies: ["Acme"], People: ["JohnDoe"] } },
	{ file: "apple-fruit.md", frontmatter: { Food: ["apple"] }, body: "An #apple a day." },
	{ file: "apple-corp.md", frontmatter: { Companies: ["apple"] }, body: "Also an #apple." },
	{ file: "unicode.md", frontmatter: { People: ["日本語", "café"], Tags: ["🌍"] } },
	{ file: "empty-values.md", frontmatter: { People: ["", "   ", "JohnDoe"] } },
	{ file: "scalar.md", frontmatter: { People: "JaneDoe" } },
	{ file: "no-typed-tags.md", frontmatter: { title: "plain" }, body: "This note has only native #tag usage." },
];

function yamlScalar(v) {
	if (typeof v === "string") {
		if (v === "" || /[:#\-\s]/.test(v)) return JSON.stringify(v);
		return v;
	}
	return JSON.stringify(v);
}

function frontmatterToYaml(fm) {
	const lines = ["---"];
	for (const [k, v] of Object.entries(fm)) {
		if (Array.isArray(v)) {
			lines.push(`${k}:`);
			for (const item of v) lines.push(`  - ${yamlScalar(item)}`);
		} else {
			lines.push(`${k}: ${yamlScalar(v)}`);
		}
	}
	lines.push("---");
	return lines.join("\n");
}

function ensureFile(filePath, content) {
	if (fs.existsSync(filePath)) {
		const existing = fs.readFileSync(filePath, "utf8");
		if (existing === content) return "unchanged";
	}
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content, "utf8");
	return "written";
}

fs.mkdirSync(FIXTURE_DIR, { recursive: true });
let written = 0;
let unchanged = 0;
for (const seed of seeds) {
	const content = frontmatterToYaml(seed.frontmatter) + (seed.body ? `\n\n${seed.body}\n` : "\n");
	const outcome = ensureFile(path.join(FIXTURE_DIR, seed.file), content);
	if (outcome === "written") written++;
	else unchanged++;
}
console.log(`[seed] wrote=${written} unchanged=${unchanged} total=${seeds.length} at ${FIXTURE_DIR}`);
