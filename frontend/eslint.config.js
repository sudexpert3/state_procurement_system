import js from "@eslint/js";
import tanstackPlugin from "@tanstack/eslint-plugin-query";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import { eslintBoundariesConfig } from "./eslint.boundaries.js";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettierConfig,
    ],
    plugins: {
      prettier: prettierPlugin,
      "simple-import-sort": simpleImportSort,
      "@tanstack/query": tanstackPlugin,
    },
    rules: {
      ...prettierPlugin.configs.recommended.rules,
      ...tanstackPlugin.configs.recommended.rules,

      "no-console": "error",
      "no-var": "error",
      "prettier/prettier": ["warn", { endOfLine: "auto" }],
      "prefer-const": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/ban-ts-comment": [
        "error",

        { "ts-ignore": "allow-with-description" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            ["^\\u0000"],
            ["^.+\\.s?css$"],
            [
              "^node:.*\\u0000$",
              "^@?\\w.*\\u0000$",
              "^[^.].*\\u0000$",
              "^\\..*\\u0000$",
            ],
            ["^react$", "^react-dom$", "^node:"],
            ["^@?\\w"],
            ["^~(/.*|$)"],
            ["^@(/.*|$)"],
            ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
            ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
          ],
        },
      ],
      "simple-import-sort/exports": "error",
    },
    languageOptions: {
      globals: globals.browser,
    },
  },
  eslintBoundariesConfig,
]);
