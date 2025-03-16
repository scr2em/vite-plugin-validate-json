import { sync } from "glob";
import fs from "fs";
import j from "json-dup-key-validator";
import { validateKeys } from "./validate-keys";
import { logger } from "./logger";
import path from "path";

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
 * @param {KeyValidation} [config.keyValidation] - Configuration for key validation
 * @returns {import('vite').Plugin} Vite plugin
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

      const files: string[] = [];

      /* collecting patterns matching files' paths */
      for (const pattern of paths) {
        const matches = sync(pattern, { ignore: ignoreFiles, nodir: true });
        logger.info(
          `  Found ${matches.length} files matching pattern: ${pattern}`
        );
        files.push(...matches);
      }

      // Validate each JSON file
      for (const file of files) {
        const content = await fs.promises.readFile(file, "utf-8");

        // We'll check the raw content for duplicate keys since JSON.parse
        // silently uses the last occurrence of duplicate keys
        const error = j.validate(content, allowDuplicateKeys);
        if (error) {
          throw new Error(
            `❌ Error while validating ${file} with error ${error} `
          );
        } else {
          logger.success(`Validated ${path.basename(file)}`);
        }

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
                logger.warn(
                  `Found ${result.missingKeys.length} missing keys in non-strict mode`
                );

                if (keyValidation.logLevel !== "silent") {
                  // Log a subset of missing keys if there are many
                  const keysToShow =
                    result.missingKeys.length > 10
                      ? result.missingKeys.slice(0, 10)
                      : result.missingKeys;

                  keysToShow.forEach((key) =>
                    logger.warn(`  Missing key: ${key}`)
                  );

                  if (result.missingKeys.length > 10) {
                    logger.warn(
                      `  ...and ${result.missingKeys.length - 10} more`
                    );
                  }
                }
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

export * from "./types";
