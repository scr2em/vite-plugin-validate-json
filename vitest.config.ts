import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html", "lcov"],
			exclude: ["**/node_modules/**", "**/dist/**", "**/tests/**"],
		},
		include: ["tests/**/*.test.ts"],
	},
});
