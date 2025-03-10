# Vite Plugin Validate JSON

A Vite plugin that validates all JSON files in specified paths.

## Features

- ✅ Validate JSON syntax in your project
- ✅ Check for duplicate keys in JSON files
- ✅ Configurable paths with glob pattern support
- ✅ Ability to ignore specific files
- ✅ TypeScript support

## Installation

```bash
npm install vite-plugin-validate-json --save-dev
# or
yarn add vite-plugin-validate-json --dev
# or
pnpm add -D vite-plugin-validate-json
```

## Usage

Add the plugin to your `vite.config.js` or `vite.config.ts`:

```js
import { defineConfig } from 'vite';
import { validateJsonPaths } from 'vite-plugin-validate-json';

export default defineConfig({
  plugins: [
    validateJsonPaths({
      paths: ['src/**/*.json', 'public/**/*.json'],
      allowDuplicateKeys: false, // default: false
      ignoreFiles: ['node_modules/**/*', 'dist/**/*'], // optional
    }),
    // other plugins...
  ],
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `paths` | `string[]` | - | Glob patterns for JSON files to validate |
| `allowDuplicateKeys` | `boolean` | `false` | Set to `true` to allow duplicate keys in JSON files |
| `ignoreFiles` | `string[]` | `[]` | Files to ignore during validation |

## How It Works

This plugin runs during the Vite build process and:

1. Finds all JSON files matching the specified glob patterns
2. Validates the JSON syntax of each file
3. Checks for duplicate keys (unless `allowDuplicateKeys` is set to `true`)
4. Throws an error if validation fails, stopping the build process

## Example Error Messages

If a JSON file contains invalid syntax:

```
❌ Error while validating src/config.json with error SyntaxError: Unexpected token } in JSON at position 42
```

If a JSON file contains duplicate keys (and `allowDuplicateKeys` is `false`):

```
❌ Error while validating src/translations.json with error Error: Duplicate key: "welcome" at position 102
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.