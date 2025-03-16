import fs from "fs";
import { sync } from "glob";
import j from "json-dup-key-validator";
import path from "path";
import { logger } from "./logger";
import { validateKeys } from "./validate-keys";

import type { Plugin } from "vite";
import type {
  KeyValidationConfig,
  LogLevel,
  ValidateJsonConfig,
  ValidationResult,
} from "./types";

/**
 * Creates a Vite plugin that validates JSON files in specified paths
 * @param {ValidateJsonConfig} config - Configuration options for the plugin
 * @param {string[]} config.paths - Glob patterns for JSON files to validate
 * @param {Object} [config.options] - Validation options
 * @param {boolean} [config.options.allowDuplicateKeys=false] - Whether to throw on duplicate keys
 * @param {string[]} [config.options.ignoreFiles=[]] - Files to ignore during validation
 *
 * @param {KeyValidation} [config.keyValidation] - Configuration for key validation with the following options:
 * @param {boolean} [config.keyValidation.enabled=false] - Whether to enable key validation
 * @param {Pattern[]} [config.keyValidation.patterns] - Patterns used to extract translation keys from source files
 *   Each pattern object has:
 *   - regex: Regular expression with a capturing group to extract the key
 *   - separator: Optional custom separator for this pattern (overrides the default)
 * @param {string[]} [config.keyValidation.sourceFiles] - Glob patterns for source files to scan for translation keys
 * @param {string} [config.keyValidation.separator="."] - Separator used for nested keys (e.g., 'common.buttons.submit')
 * @param {boolean} [config.keyValidation.strict=true] - If true, missing keys will cause validation to fail
 *   If false, missing keys will be logged as warnings but validation will pass
 * @param {LogLevel} [config.keyValidation.logLevel="info"] - Controls verbosity of logging:
 *   - 'silent': No missing keys are logged
 *   - 'error': Only errors are logged
 *   - 'warn': Warnings and errors are logged
 *   - 'info': Informational messages, warnings, and errors are logged
 *   - 'verbose': All messages including detailed debugging information are logged * @returns {import('vite').Plugin} Vite plugin
 */
export function validateJsonPaths(config: ValidateJsonConfig): Plugin {
  const {
    paths,
    allowDuplicateKeys = false,
    ignoreFiles = [],
    keyValidation = { enabled: false },
  } = config;

  return {
    name: "vite-plugin-validate-json",

    async buildStart() {
      logger.info(`🔍 Validating JSON files...`);

      // Find all JSON files matching the glob patterns

      const files: string[] = collectJsonFiles(paths, ignoreFiles);

      // Validate each JSON file
      for (const file of files) {
        const content = await validateJsonFile(file, allowDuplicateKeys);

        if (keyValidation.enabled) {
          logger.info(`🔑 Checking translation keys...`);

          const jsonCache = new Map<string, any>();

          /* parse JSONs to objects*/
          const json = JSON.parse(content);
          jsonCache.set(file, json);

          const keyConfig: KeyValidationConfig = {
            patterns: keyValidation.patterns,
            sourceFiles: keyValidation.sourceFiles,
            jsonFiles: files,
            separator: keyValidation.separator ?? ".",
            strict: keyValidation.strict ?? true,
          };

          try {
            const result: ValidationResult = await validateKeys(keyConfig);

            if (result.success) {
              logger.success(
                `Key validation passed${
                  result.missingKeys.length > 0 ? " (non-strict mode)" : ""
                }`
              );

              if (result.missingKeys.length > 0) {
                logMissingKeys(result.missingKeys, keyValidation.logLevel);
              }
            } else {
              // In strict mode with missing keys, this will fail the build
              throw new Error(result.errorMessage ?? "Key validation failed");
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            logger.error(`Key validation failed: ${errorMessage}`);
            throw error; // Propagate the error to fail the build
          }
        }
      }
    },
  };
}

function collectJsonFiles(patterns: string[], ignoreFiles: string[]): string[] {
  const files: string[] = [];

  for (const pattern of patterns) {
    const matches = sync(pattern, { ignore: ignoreFiles, nodir: true });
    logger.info(`\tFound ${matches.length} files matching pattern: ${pattern}`);
    files.push(...matches);
  }

  return files;
}

async function validateJsonFile(
  filePath: string,
  allowDuplicateKeys: boolean
): Promise<string> {
  const content = await fs.promises.readFile(filePath, "utf-8");

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

function logMissingKeys(missingKeys: string[], logLevel?: LogLevel): void {
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
export * from "./types";
