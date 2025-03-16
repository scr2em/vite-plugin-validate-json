import { sync } from "glob";
import fs from "node:fs/promises";
import { logger } from "./logger";
import type { KeyValidationConfig, Pattern, ValidationResult } from "./types";

/**
 * Validates translation keys found in source files against JSON translation files
 */
export async function validateKeys(
  config: KeyValidationConfig,
  jsonFiles?: Map<string, any>
): Promise<ValidationResult> {
  try {
    const { patterns, sourceFiles, jsonFiles, separator, strict } = config;

    logger.info("🔍 Starting key validation process...");

    const sourceKeys = await extractSourceKeys(
      sourceFiles,
      patterns,
      separator
    );

    logger.info(`📄 Found ${sourceKeys.size} unique keys in source files`);

    const jsonKeys = await extractJsonKeys(jsonFiles, separator);
    logger.info(`🔑 Found ${jsonKeys.size} unique keys in JSON files`);

    const missingKeys = findMissingKeys(sourceKeys, jsonKeys);
    const success = missingKeys.length === 0 || !strict;

    if (success) {
      logger.success(`Validation ${strict ? "passed" : "completed"}`);
    } else {
      logger.error(`Validation failed: ${missingKeys.length} missing keys`);
    }

    return createValidationResult(success, missingKeys);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));

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

  logger.info(
    `📁 Scanning source files with ${sourcePatterns.length} patterns...`
  );

  for (const pattern of sourcePatterns) {
    const files = sync(pattern);
    logger.info(`\t- Pattern ${pattern} matched ${files.length} files`);

    for (const file of files) {
      try {
        const content = await fs.readFile(file, { encoding: "utf8" });
        const initialSize = sourceKeys.size;
        extractKeysFromSource(content, patterns, sourceKeys, defaultSeparator);
        const newKeys = sourceKeys.size - initialSize;

        if (newKeys > 0) {
          logger.info(`\t\t\t✓ Found ${newKeys} keys in ${file}`);
        }
      } catch (error) {
        logger.warn(
          `Error reading source file ${file}: ${
            error instanceof Error ? error.message : String(error)
          }`
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

  logger.info(`🗂️ Processing ${jsonFiles.length} JSON files...`);

  for (const file of jsonFiles) {
    try {
      logger.info(`\t\t- Reading ${file}`);
      const content = await fs.readFile(file, { encoding: "utf8" });
      const json = JSON.parse(content);
      const initialSize = jsonKeys.size;
      extractKeysFromJson(json, "", jsonKeys, separator);
      logger.info(`\t\t\t✓ Extracted ${jsonKeys.size - initialSize} keys`);
    } catch (error) {
      const errorMsg = `Error parsing JSON file ${file}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      logger.error(errorMsg);
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
    logger.warn(`Found ${missingKeys.length} missing keys:`);

    missingKeys.forEach((key, index) => {
      if (index < 10 || missingKeys.length <= 20) {
        logger.warn(`\t- ${key}`);
      } else if (index === 10) {
        logger.warn(` \t... and ${missingKeys.length - 10} more`);
      }
    });
  } else {
    logger.success(`All keys found in translation files!`);
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
