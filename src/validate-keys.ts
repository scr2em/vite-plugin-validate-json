import { sync } from "glob";
import fs from "node:fs/promises";
import chalk from "chalk";

interface Pattern {
  regex: string;
  separator?: string; // Optional custom separator per pattern
}

interface KeyValidationConfig {
  patterns: Pattern[];
  sourceFiles: string[];
  jsonFiles: string[];
  separator: string /* Default separator for nested keys */;
  strict: boolean;
}

interface ValidationResult {
  success: boolean;
  missingKeys: string[];
  errorMessage?: string;
}

/**
 * Validates translation keys found in source files against JSON translation files
 */
export async function validateKeys(
  config: KeyValidationConfig
): Promise<ValidationResult> {
  const { patterns, sourceFiles, jsonFiles, separator, strict } = config;

  console.log(chalk.blue.bold(`🔍 Starting key validation process...`));

  const sourceKeys = new Set<string>();
  const jsonKeys = new Set<string>();
  const missingKeys: string[] = [];

  //   Extract source files' keys in normalized form
  for (const pattern of sourceFiles) {
    const files = sync(pattern);

    for (const file of files) {
      try {
        const content = await fs.readFile(file, { encoding: "utf8" });
        extractKeysFromSource(content, patterns, sourceKeys, separator);
      } catch (error) {
        if (error instanceof Error)
          console.warn(`Error reading source file ${file}: ${error.message}`);
      }
    }
  }

  for (const file of jsonFiles) {
    try {
      const content = await fs.readFile(file, { encoding: "utf8" });
      const json = JSON.parse(content);
      extractKeysFromJson(json, "", jsonKeys, separator);
    } catch (error) {
      if (error instanceof Error)
        throw new Error(`Error parsing JSON file ${file}: ${error.message}`);
    }
  }

  for (const key of sourceKeys) {
    if (!jsonKeys.has(key)) {
      missingKeys.push(key);
    }
  }

  const success = missingKeys.length === 0 || !strict;
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
    const patternRegex = new RegExp(regex, "g"); // global regex
    let match;

    while ((match = patternRegex.exec(content)) !== null) {
      // each global regex exec, starts from the last match position
      if (match[1]) {
        const extractedKey = match[1];

        if (separator !== defaultSeparator) {
          // Split by pattern separator and join by default separator
          const parts = extractedKey.split(separator);
          const normalizedKey = parts.join(defaultSeparator); // keep all keys joined the same way, to be prepared for the next step
          keys.add(normalizedKey);
        } else {
          keys.add(extractedKey);
        }
      }
    }
  }
}

function extractKeysFromJson(
  obj: any,
  prefix: string,
  keys: Set<string>,
  separator: string,
  visited = new Set() // to track visited objects
): void {
  // use the default separator to build the list of json keys
  if (!obj || typeof obj !== "object") {
    return;
  }

  // Check for circular references
  if (visited.has(obj)) return; // Skip this object if already processed

  // add this object to visited objects
  visited.add(obj);

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;

    keys.add(newKey);

    // For nesting condition ==> no arrays expected
    if (value && typeof value === "object") {
      if (Array.isArray(value)) {
        // Process array elements (if they're objects)
        value.forEach((item) => {
          if (item && typeof item === "object") {
            extractKeysFromJson(item, newKey, keys, separator, visited);
          }
        });
      } else {
        extractKeysFromJson(value, newKey, keys, separator, visited);
      }
    }
  }
}
