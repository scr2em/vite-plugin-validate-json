/**
 * Pattern configuration for extracting translation keys from source files
 */
export interface Pattern {
  /** Regular expression to match translation keys, with capturing group */
  regex: string | RegExp;
  /** Optional custom separator used in this pattern (if different from default) */
  separator?: string;
}

/**
 * Configuration for key validation
 */
export interface KeyValidationConfig {
  /** Patterns used to extract keys from source files */
  patterns: Pattern[];
  /** Glob patterns for source files to scan */
  sourceFiles: string[];
  /** Paths to JSON translation files to validate against */
  jsonFiles: string[];
  /** Separator used for nested keys (default: '.') */
  separator: string;
  /** Whether to treat missing keys as errors (default: true) */
  strict: boolean;
}

/**
 * Result of key validation process
 */
export interface ValidationResult {
  /** Whether validation passed */
  success: boolean;
  /** List of keys found in source but missing in translations */
  missingKeys: string[];
  /** Error message (if validation failed) */
  errorMessage?: string;
}

interface DisabledKeyValidation {
  /** Whether to enable key validation (default: false) */
  enabled?: false;
}

interface EnabledKeyValidation {
  /** Whether to enable key validation (default: false) */
  enabled: true;
  /** Patterns used to extract keys from source */
  patterns: Pattern[];
  /** Glob patterns for source files to scan */
  sourceFiles: string[];
  /** Separator used for nested keys (default: '.') */
  separator?: string;
  /** Whether to treat missing keys as errors (default: true) */
  strict?: boolean;
  /** Log level for validation messages */
  logLevel?: "silent" | "error" | "warn" | "info" | "verbose";
}

type KeyValidation = EnabledKeyValidation | DisabledKeyValidation;

/**
 * Configuration for the JSON validation plugin
 */
export interface ValidateJsonConfig {
  /** Glob patterns for JSON files to validate */
  paths: string[];
  /** Whether to allow duplicate keys in JSON (default: false) */
  allowDuplicateKeys?: boolean;
  /** Files to ignore during validation */
  ignoreFiles?: string[];

  /** Configuration for key validation */
  keyValidation?: KeyValidation;
}

/**
 * Log levels for the plugin
 */
export type LogLevel = "silent" | "error" | "warn" | "info" | "verbose";
