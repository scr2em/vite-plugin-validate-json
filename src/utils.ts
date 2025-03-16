import { sync } from "glob";
import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "./logger";
import type { LogLevel, Pattern, ValidationResult } from "./types";
import j from "json-dup-key-validator";

export async function extractSourceKeys(
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

export async function extractJsonKeys(
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

export function findMissingKeys(
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

export function createValidationResult(
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

export function extractKeysFromSource(
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

export function normalizeKey(
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

export function extractKeysFromJson(
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

export function processArrayElements(
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

export async function validateJsonFile(
  filePath: string,
  allowDuplicateKeys: boolean
): Promise<string> {
  const content = await fs.readFile(filePath, "utf-8");

  // Check for duplicate keys and validate JSON syntax
  const error = j.validate(content, allowDuplicateKeys);
  if (error) {
    throw new Error(
      `❌ Error while validating ${filePath} with error ${error}`
    );
  } else {
    logger.success(`Validated ${path.basename(filePath)}`);
  }

  return content;
}
export function logMissingKeys(
  missingKeys: string[],
  logLevel?: LogLevel
): void {
  logger.warn(`Found ${missingKeys.length} missing keys in non-strict mode`);

  if (logLevel !== "silent") {
    // Log a subset of missing keys if there are many
    const keysToShow =
      missingKeys.length > 10 ? missingKeys.slice(0, 10) : missingKeys;

    keysToShow.forEach((key) => logger.warn(`  Missing key: ${key}`));

    if (missingKeys.length > 10) {
      logger.warn(`\t\t...and ${missingKeys.length - 10} more`);
    }
  }
}
