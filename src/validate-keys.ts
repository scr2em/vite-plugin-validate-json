import { logger } from "./logger";
import type { KeyValidationConfig, ValidationResult } from "./types";
import {
  createValidationResult,
  extractJsonKeys,
  extractSourceKeys,
  findMissingKeys,
} from "./utils";

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
