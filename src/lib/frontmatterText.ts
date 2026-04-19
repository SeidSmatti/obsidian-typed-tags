// Pure helpers that operate on the raw markdown text of a note, narrowly scoped to
// the category-rename migration. Never serializes user-authored YAML beyond the
// single key being renamed — we leave indentation, comments, quoting, and value
// formatting exactly as the user wrote them.

const FENCE = "---";

export interface FrontmatterBlock {
	startLine: number; // index of the opening `---` line
	endLine: number; // index of the closing `---` line
	lines: string[]; // entire file split by \n
}

export function detectFrontmatter(text: string): FrontmatterBlock | null {
	const lines = text.split("\n");
	if (lines.length === 0 || lines[0].trim() !== FENCE) return null;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === FENCE) return { startLine: 0, endLine: i, lines };
	}
	return null;
}

export interface KeyLine {
	index: number;
	indent: string;
	rawKey: string;
	suffix: string; // everything after the colon, including leading space
}

export function findTopLevelKey(block: FrontmatterBlock, key: string): KeyLine | null {
	for (let i = block.startLine + 1; i < block.endLine; i++) {
		const parsed = parseTopLevelKeyLine(block.lines[i]);
		if (parsed && parsed.indent === "" && parsed.rawKey === key) {
			return { index: i, ...parsed };
		}
	}
	return null;
}

function parseTopLevelKeyLine(
	line: string,
): { indent: string; rawKey: string; suffix: string } | null {
	const m = /^(\s*)([^\s#:][^:]*):(.*)$/.exec(line);
	if (!m) return null;
	return { indent: m[1], rawKey: m[2].trim(), suffix: m[3] };
}

export type RewriteStatus = "ok" | "no-frontmatter" | "no-key" | "collision";

export interface RewriteResult {
	status: RewriteStatus;
	changed: boolean;
	newText: string;
}

export function rewriteFrontmatterKey(text: string, from: string, to: string): RewriteResult {
	if (from === to) return { status: "ok", changed: false, newText: text };
	const block = detectFrontmatter(text);
	if (!block) return { status: "no-frontmatter", changed: false, newText: text };
	const fromLine = findTopLevelKey(block, from);
	if (!fromLine) return { status: "no-key", changed: false, newText: text };
	const toLine = findTopLevelKey(block, to);
	if (toLine) return { status: "collision", changed: false, newText: text };
	const original = block.lines[fromLine.index];
	const rewritten = `${fromLine.indent}${to}:${fromLine.suffix}`;
	if (original === rewritten) return { status: "ok", changed: false, newText: text };
	const lines = block.lines.slice();
	lines[fromLine.index] = rewritten;
	return { status: "ok", changed: true, newText: lines.join("\n") };
}

