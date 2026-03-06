import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "url";
import path from "path";
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // Global ignores (replaces ignorePatterns in .eslintrc.js)
  {
    ignores: [
      "**/.*.js",
      "bin/**",
      "scripts/**",
      "tests/**",
      "vitest.config.js",
      "playwright.config.js",
      "rollup.config.mjs",
      "eslint.config.mjs",
    ],
  },

  // Load airbnb-base + prettier via the FlatCompat adapter
  ...compat.extends("airbnb-base", "prettier"),

  // Language options and project-specific rule overrides
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      camelcase: ["off"],
      "no-return-assign": ["error", "except-parens"],
      "no-restricted-syntax": [
        "error",
        "ForInStatement",
        "LabeledStatement",
        "WithStatement",
      ],
      "no-param-reassign": ["off"],
      "no-underscore-dangle": ["off"],
      "no-plusplus": ["off"],
      "prefer-destructuring": ["off"],
    },
  },
];
