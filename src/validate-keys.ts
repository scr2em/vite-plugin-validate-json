import { sync } from "glob";
import fs from "node:fs/promises";
import chalk from "chalk";
import type { KeyValidationConfig, Pattern, ValidationResult } from "./types";
import { logger } from "./logger";

/**
 * Validates translation keys found in source files against JSON translation files
 */
export async function validateKeys(
  config: KeyValidationConfig
): Promise<ValidationResult> {
  try {
    const { patterns, sourceFiles, jsonFiles, separator, strict } = config;

    logger.info("🔍 Starting key validation process...");

    const sourceKeys = await extractSourceKeys(
      sourceFiles,
      patterns,
      separator
    );
    console.log(
      chalk.cyan(
        `📄 Found ${chalk.bold(sourceKeys.size)} unique keys in source files`
      )
    );

    const jsonKeys = await extractJsonKeys(jsonFiles, separator);
    console.log(
      chalk.cyan(
        `🔑 Found ${chalk.bold(jsonKeys.size)} unique keys in JSON files`
      )
    );

    const missingKeys = findMissingKeys(sourceKeys, jsonKeys);
    const success = missingKeys.length === 0 || !strict;

    if (success) {
      console.log(
        chalk.green.bold(`✅ Validation ${strict ? "passed" : "completed"}`)
      );
    } else {
      console.log(
        chalk.red.bold(
          `❌ Validation failed: ${missingKeys.length} missing keys`
        )
      );
    }

    return createValidationResult(success, missingKeys);
  } catch (error) {
    console.error(
      chalk.bgRed.white.bold(` ERROR `),
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    return {
      success: false,
      missingKeys: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

async function extractSourceKeys(
  sourcePatterns: string[],
  patterns: Pattern[],
  defaultSeparator: string
): Promise<Set<string>> {
  const sourceKeys = new Set<string>();

  console.log(
    chalk.blue(
      `📁 Scanning source files with ${chalk.bold(
        sourcePatterns.length
      )} patterns...`
    )
  );

  for (const pattern of sourcePatterns) {
    const files = sync(pattern);
    console.log(
      chalk.gray(
        `  - Pattern ${chalk.italic(pattern)} matched ${files.length} files`
      )
    );

    for (const file of files) {
      try {
        const content = await fs.readFile(file, { encoding: "utf8" });
        const initialSize = sourceKeys.size;
        extractKeysFromSource(content, patterns, sourceKeys, defaultSeparator);
        const newKeys = sourceKeys.size - initialSize;

        if (newKeys > 0) {
          console.log(
            chalk.gray(`    ✓ Found ${chalk.bold(newKeys)} keys in ${file}`)
          );
        }
      } catch (error) {
        console.warn(
          chalk.yellow(
            `⚠️  Error reading source file ${chalk.bold(file)}: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        );
      }
    }
  }

  return sourceKeys;
}

async function extractJsonKeys(
  jsonFiles: string[],
  separator: string
): Promise<Set<string>> {
  const jsonKeys = new Set<string>();

  console.log(
    chalk.blue(`🗂️  Processing ${chalk.bold(jsonFiles.length)} JSON files...`)
  );

  for (const file of jsonFiles) {
    try {
      console.log(chalk.gray(`  - Reading ${file}`));
      const content = await fs.readFile(file, { encoding: "utf8" });
      const json = JSON.parse(content);
      const initialSize = jsonKeys.size;
      extractKeysFromJson(json, "", jsonKeys, separator);
      console.log(
        chalk.gray(
          `    ✓ Extracted ${chalk.bold(jsonKeys.size - initialSize)} keys`
        )
      );
    } catch (error) {
      const errorMsg = `Error parsing JSON file ${file}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(chalk.red(`❌ ${errorMsg}`));
      throw new Error(errorMsg);
    }
  }

  return jsonKeys;
}

function findMissingKeys(
  sourceKeys: Set<string>,
  jsonKeys: Set<string>
): string[] {
  const missingKeys: string[] = [];

  for (const key of sourceKeys) {
    if (!jsonKeys.has(key)) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    console.log(
      chalk.yellow(`⚠️  Found ${chalk.bold(missingKeys.length)} missing keys:`)
    );
    missingKeys.forEach((key, index) => {
      if (index < 10 || missingKeys.length <= 20) {
        console.log(chalk.yellow(`  - ${key}`));
      } else if (index === 10) {
        console.log(chalk.yellow(`  ... and ${missingKeys.length - 10} more`));
      }
    });
  } else {
    console.log(chalk.green(`🎉 All keys found in translation files!`));
  }

  return missingKeys;
}

function createValidationResult(
  success: boolean,
  missingKeys: string[]
): ValidationResult {
  const result: ValidationResult = {
    success,
    missingKeys,
  };

  if (!success) {
    result.errorMessage = `Found ${
      missingKeys.length
    } missing keys in translations: ${missingKeys.join(", ")}`;
  }

  return result;
}

function extractKeysFromSource(
  content: string,
  patterns: Pattern[],
  keys: Set<string>,
  defaultSeparator: string
): void {
  for (const { regex, separator = defaultSeparator } of patterns) {
    const patternRegex = new RegExp(regex, "g");
    let match;

    while ((match = patternRegex.exec(content)) !== null) {
      if (match[1]) {
        const extractedKey = match[1];
        const normalizedKey = normalizeKey(
          extractedKey,
          separator,
          defaultSeparator
        );
        keys.add(normalizedKey);
      }
    }
  }
}

function normalizeKey(
  key: string,
  currentSeparator: string,
  targetSeparator: string
): string {
  if (currentSeparator === targetSeparator) {
    return key;
  }

  // Split by pattern separator and join by default separator
  return key.split(currentSeparator).join(targetSeparator);
}

function extractKeysFromJson(
  obj: any,
  prefix: string,
  keys: Set<string>,
  separator: string,
  visited = new Set()
): void {
  if (!obj || typeof obj !== "object" || visited.has(obj)) {
    return;
  }

  visited.add(obj);

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;
    keys.add(newKey);

    if (value && typeof value === "object") {
      if (Array.isArray(value)) {
        processArrayElements(value, newKey, keys, separator, visited);
      } else {
        extractKeysFromJson(value, newKey, keys, separator, visited);
      }
    }
  }
}

function processArrayElements(
  array: any[],
  prefix: string,
  keys: Set<string>,
  separator: string,
  visited: Set<any>
): void {
  array.forEach((item) => {
    if (item && typeof item === "object") {
      extractKeysFromJson(item, prefix, keys, separator, visited);
    }
  });
}
