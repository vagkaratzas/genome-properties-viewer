module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["airbnb-base", "prettier"],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  ignorePatterns: [".*.js", "bin/*", "scripts/*", "tests/*", "vitest.config.js", "playwright.config.js"],
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
};
