import {sync} from 'glob'
import fs from 'fs'
import j from 'json-dup-key-validator'

/**
 * Creates a Vite plugin that validates JSON files in specified paths
 * @param {Object} config - Configuration options
 * @param {string[]} config.paths - Glob patterns for JSON files to validate
 * @param {Object} [config.options] - Validation options
 * @param {boolean} [config.options.allowDuplicateKeys=false] - Whether to throw on duplicate keys
 * @param {string[]} [config.options.ignoreFiles=[]] - Files to ignore during validation
 * @returns {import('vite').Plugin} Vite plugin
 */
export function validateJsonPaths(config: {
	paths: string[];
	allowDuplicateKeys?: boolean,
	ignoreFiles?: string[];

}) {
	const {paths, allowDuplicateKeys = false, ignoreFiles = []} = config

	return {
		name: 'vite-plugin-validate-json',

		async buildStart() {
			// Find all JSON files matching the glob patterns

			const files = []
			for (const pattern of paths) {
				const matches = sync(pattern, {ignore: ignoreFiles, nodir: true})

				files.push(...matches)
			}


			// Validate each JSON file
			for (const file of files) {
				const content = await fs.promises.readFile(file, 'utf-8')

				// We'll check the raw content for duplicate keys since JSON.parse
				// silently uses the last occurrence of duplicate keys
				const error = j.validate(content, allowDuplicateKeys)
				if (error) {
					throw new Error(`❌ Error while validating ${file} with error ${error} `)
				} else {
					console.log(`✅ Validated ${file} JSON files successfully.`)

				}

			}

		},
	}
}
