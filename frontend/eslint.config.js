import js from "@eslint/js";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["src/gen"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    // Build tooling runs in Node, not the browser.
    files: ["*.{js,ts}", "scripts/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // shadcn/ui primitives re-export Radix sub-components next to the wrapper
    // component. That is the generated shape, so fast refresh gives up on these
    // files by design.
    files: ["src/components/ui/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
]);
