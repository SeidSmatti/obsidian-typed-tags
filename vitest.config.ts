import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/unit/**/*.test.ts"],
		environment: "node",
		coverage: {
			provider: "v8",
			include: ["src/lib/**/*.ts"],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 75,
				statements: 90,
			},
		},
	},
});
