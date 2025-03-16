import fs from "fs";
import { sync } from "glob";
import j from "json-dup-key-validator";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateJsonPaths } from "../src";

vi.mock("glob");
vi.mock("json-dup-key-validator");

const mockReadFile = vi.fn().mockResolvedValue("{}");

fs.promises.readFile = mockReadFile;

vi.mocked(sync).mockImplementation(() => []);
vi.mocked(j.validate).mockReturnValue(null);

describe("Core Functionality", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		console.log = vi.fn();
		console.error = vi.fn();
	});

	describe("Plugin configuration", () => {
		it("should process provided paths", async () => {
			const plugin = validateJsonPaths({
				paths: ["test/*.json", "src/*.json"],
			});

			vi.mocked(sync).mockReturnValueOnce(["test/a.json", "test/b.json"]);
			vi.mocked(sync).mockReturnValueOnce(["src/c.json"]);

			await plugin.buildStart();

			expect(sync).toHaveBeenCalledTimes(2);
			expect(sync).toHaveBeenCalledWith("test/*.json", {
				ignore: [],
				nodir: true,
			});
			expect(sync).toHaveBeenCalledWith("src/*.json", {
				ignore: [],
				nodir: true,
			});
		});

		it("should respect ignoreFiles option", async () => {
			const plugin = validateJsonPaths({
				paths: ["**/*.json"],
				ignoreFiles: ["ignore-me.json", "dist/**/*"],
			});

			await plugin.buildStart();

			expect(sync).toHaveBeenCalledWith("**/*.json", {
				ignore: ["ignore-me.json", "dist/**/*"],
				nodir: true,
			});
		});
	});

	describe("JSON validation", () => {
		it("should validate each matched file", async () => {
			const plugin = validateJsonPaths({ paths: ["*.json"] });

			vi.mocked(sync).mockReturnValueOnce(["file1.json", "file2.json"]);

			await plugin.buildStart();

			expect(mockReadFile).toHaveBeenCalledTimes(2);
			expect(mockReadFile).toHaveBeenCalledWith("file1.json", "utf-8");
			expect(mockReadFile).toHaveBeenCalledWith("file2.json", "utf-8");
			expect(j.validate).toHaveBeenCalledTimes(2);
		});

		it("should validate JSON syntax and throw on invalid JSON", async () => {
			const plugin = validateJsonPaths({ paths: ["*.json"] });

			vi.mocked(sync).mockReturnValueOnce(["file1.json", "file2.json"]);

			// Valid JSON content mock
			mockReadFile.mockResolvedValueOnce('{"key": "value"}');
			// Invalid JSON syntax mock
			mockReadFile.mockResolvedValueOnce('{"key": "value",}');

			vi.mocked(j.validate)
				.mockReturnValueOnce(null) // Valid JSON
				.mockReturnValueOnce("Unexpected token }"); // Invalid JSON

			await expect(plugin.buildStart()).rejects.toThrow(
				"❌ Error while validating file2.json with error Unexpected token }",
			);

			expect(j.validate).toHaveBeenCalledTimes(2);
		});

		it("should detect duplicate keys in JSON files", async () => {
			const plugin = validateJsonPaths({ paths: ["*.json"] });

			vi.mocked(sync).mockReturnValueOnce(["translations.json"]);
			mockReadFile.mockResolvedValueOnce('{"key": "value1", "key": "value2"}');

			vi.mocked(j.validate).mockReturnValueOnce('Error: Duplicate key: "key"');

			await expect(plugin.buildStart()).rejects.toThrow(
				/❌ Error while validating translations.json with error Error: Duplicate key: "key"/,
			);
		});

		it("should allow duplicate keys when configured", async () => {
			const plugin = validateJsonPaths({
				paths: ["*.json"],
				allowDuplicateKeys: true,
			});

			vi.mocked(sync).mockReturnValueOnce(["dupes.json"]);
			mockReadFile.mockResolvedValueOnce('{"key": "value1", "key": "value2"}');

			await plugin.buildStart();

			expect(j.validate).toHaveBeenCalledWith(
				'{"key": "value1", "key": "value2"}',
				true,
			);
		});

		it("should throw an error and stop the build process if validation fails", async () => {
			const plugin = validateJsonPaths({ paths: ["*.json"] });

			vi.mocked(sync).mockReturnValueOnce(["invalid.json"]);
			mockReadFile.mockResolvedValueOnce('{"unclosed": "string"');
			vi.mocked(j.validate).mockReturnValueOnce(
				"SyntaxError: Unexpected end of JSON input",
			);

			await expect(plugin.buildStart()).rejects.toThrow();
		});
	});
});
