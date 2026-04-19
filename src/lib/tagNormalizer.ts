export function normalize(raw: unknown): string | null {
	if (typeof raw !== "string") return null;
	let s = raw.trim();
	if (s.startsWith("#")) s = s.slice(1).trim();
	return s.length === 0 ? null : s;
}

export function normalizeAll(values: readonly unknown[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const v of values) {
		const n = normalize(v);
		if (n !== null && !seen.has(n)) {
			seen.add(n);
			out.push(n);
		}
	}
	return out;
}
