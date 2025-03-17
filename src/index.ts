import { sync } from "glob";
import { logger } from "./logger";
import { validateKeys } from "./validate-keys";
import { logMissingKeys, validateJsonFile } from "./utils";

import type { Plugin } from "vite";
import type {
  KeyValidationConfig,
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
        await validateJsonFile(file, allowDuplicateKeys);

        if (keyValidation.enabled) {
          logger.info(`🔑 Checking translation keys...`);

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

export * from "./types";
