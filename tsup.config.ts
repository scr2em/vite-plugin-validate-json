import {defineConfig} from 'tsup'

export default defineConfig({
	entry: ["src/index.ts"],
	platform: "node",
	format: ["cjs"],
	outDir: "./dist",
	dts: true, // Generate declaration file (.d.ts)
	splitting: false,
	sourcemap: true,
	minify: true,
	clean: true,
})