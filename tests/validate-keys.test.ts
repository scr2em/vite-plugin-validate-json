// src/core/validator.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { validateKeys } from "../src/validate-keys";
import fs from "node:fs/promises";
import { sync as globSync } from "glob";

// Mock dependencies
vi.mock("node:fs/promises");
vi.mock("glob", () => ({
  sync: vi.fn(),
}));

const appFilePath = "src/components/App.tsx";

describe("validateKeys", () => {
  // Setup common test config
  const baseConfig = {
    patterns: [{ regex: "t\\(['\"]([^'\"]+)['\"]\\)" }],
    sourceFiles: ["src/**/*.{ts,tsx}"],
    jsonFiles: ["src/locales/en.json"],
    separator: ".",
    strict: true,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return success when all keys are found", async () => {
    vi.mocked(globSync).mockReturnValue([appFilePath]);

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      if (path === appFilePath) {
        return "t('common.hello'); t('common.welcome');" as any;
      }
      if (path === "src/locales/en.json") {
        return JSON.stringify({
          common: {
            hello: "Hello",
            welcome: "Welcome",
          },
        }) as any;
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    // Run the function
    const result = await validateKeys(baseConfig);

    // Verify the result
    expect(result.success).toBe(true);
    expect(result.missingKeys).toEqual([]);
    expect(result.errorMessage).toBeUndefined();

    // Verify the mocks were called correctly
    expect(globSync).toHaveBeenCalledWith("src/**/*.{ts,tsx}");
    expect(fs.readFile).toHaveBeenCalledWith(appFilePath, {
      encoding: "utf8",
    });
    expect(fs.readFile).toHaveBeenCalledWith("src/locales/en.json", {
      encoding: "utf8",
    });
  });

  it("should find missing keys when they exist in source but not in translations", async () => {
    // Mock implementation
    vi.mocked(globSync).mockReturnValue([appFilePath]);

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      if (path === appFilePath) {
        return "t('common.hello'); t('common.missing'); t('other.key');" as any;
      }
      if (path === "src/locales/en.json") {
        return JSON.stringify({
          common: {
            hello: "Hello",
            // missing key not here
          },
          // other.key not here
        }) as any;
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    // Run the function
    const result = await validateKeys(baseConfig);

    // Verify the result
    expect(result.success).toBe(false);
    expect(result.missingKeys).toEqual(["common.missing", "other.key"]);
    expect(result.errorMessage).toContain("Found 2 missing keys");
  });

  it("should handle custom separators in patterns", async () => {
    // Config with custom separator
    const configWithCustomSeparator = {
      ...baseConfig,
      patterns: [{ regex: "t\\(['\"]([^'\"]+)['\"]\\)", separator: "/" }],
    };

    // Mock implementation
    vi.mocked(globSync).mockReturnValue([appFilePath]);

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      if (path === appFilePath) {
        return "t('common/hello');" as any;
      }
      if (path === "src/locales/en.json") {
        return JSON.stringify({
          common: {
            hello: "Hello",
          },
        }) as any;
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    // Run the function
    const result = await validateKeys(configWithCustomSeparator);

    // Verify the result - the '/' in the source should be converted to '.' for JSON
    expect(result.success).toBe(true);
    expect(result.missingKeys).toEqual([]);
  });

  it("should handle non-strict mode by succeeding even with missing keys", async () => {
    // Non-strict config
    const nonStrictConfig = {
      ...baseConfig,
      strict: false,
    };

    // Mock implementation
    vi.mocked(globSync).mockReturnValue([appFilePath]);

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      if (path === appFilePath) {
        return "t('common.missing');" as any;
      }
      if (path === "src/locales/en.json") {
        return JSON.stringify({}) as any;
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    // Run the function
    const result = await validateKeys(nonStrictConfig);

    // Verify the result - should succeed despite missing key
    expect(result.success).toBe(true);
    expect(result.missingKeys).toEqual(["common.missing"]);
    expect(result.errorMessage).toBeUndefined();
  });

  it("should handle errors when reading source files", async () => {
    // Mock implementation
    vi.mocked(globSync).mockReturnValue([
      appFilePath,
      "src/components/Error.tsx",
    ]);

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      if (path === appFilePath) {
        return "t('common.hello');" as any;
      }
      if (path === "src/components/Error.tsx") {
        throw new Error("File read error");
      }
      if (path === "src/locales/en.json") {
        return JSON.stringify({
          common: {
            hello: "Hello",
          },
        }) as any;
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    // Mock console.warn to verify warning
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Run the function - should continue despite error in one file
    const result = await validateKeys(baseConfig);

    // Verify the result - should have succeeded with the good file
    expect(result.success).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error reading source file")
    );
  });

  it("should handle multiple patterns", async () => {
    // Config with multiple patterns
    const multiPatternConfig = {
      ...baseConfig,
      patterns: [
        { regex: "t\\(['\"]([^'\"]+)['\"]\\)" },
        { regex: "useTranslation\\(['\"]([^'\"]+)['\"]\\)" },
      ],
    };

    // Mock implementation
    vi.mocked(globSync).mockReturnValue([appFilePath]);

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      if (path === appFilePath) {
        return "t('common.hello'); useTranslation('common.section');" as any;
      }
      if (path === "src/locales/en.json") {
        return JSON.stringify({
          common: {
            hello: "Hello",
            section: "Section",
          },
        }) as any;
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    // Run the function
    const result = await validateKeys(multiPatternConfig);

    // Verify the result
    expect(result.success).toBe(true);
    expect(result.missingKeys).toEqual([]);
  });
});
