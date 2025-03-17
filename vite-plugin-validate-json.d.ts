declare module "vite-plugin-validate-json" {
  import { type Plugin } from "vite";

  export interface Pattern {
    regex: string | RegExp;
    separator?: string;
  }

  export interface KeyValidationConfig {
    patterns: Pattern[];
    sourceFiles: string[];
    jsonFiles: string[];
    separator: string;
    strict: boolean;
  }

  export interface ValidationResult {
    success: boolean;
    missingKeys: string[];
    errorMessage?: string;
  }

  export interface ValidateJsonConfig {
    paths: string[];
    allowDuplicateKeys?: boolean;
    ignoreFiles?: string[];
    keyValidation?: {
      enabled: boolean;
      patterns?: Pattern[];
      sourceFiles?: string[];
      separator?: string;
      strict?: boolean;
      logLevel?: "silent" | "error" | "warn" | "info" | "verbose";
    };
  }

  export type LogLevel = "silent" | "error" | "warn" | "info" | "verbose";

  /**
   * Validates translation keys found in source files against JSON translation files
   */
  export function validateKeys(
    config: KeyValidationConfig
  ): Promise<ValidationResult>;

  /**
   * Creates a Vite plugin that validates JSON files and optionally checks for missing translation keys
   */
  export default function validateJsonPaths(config: ValidateJsonConfig): Plugin;
}
