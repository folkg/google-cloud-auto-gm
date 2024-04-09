module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/coverage/**/*", // Ignore coverage files.
    "jest.config.js",
    "**/*.spec.ts",
    "vite.config.ts",
  ],
  plugins: ["@typescript-eslint", "import"],
  rules: {
    "import/no-unresolved": 0,
    "@typescript-eslint/no-var-requires": 0,
    "require-jsdoc": 0,
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-unsafe-declaration-merging": "warn",
  },
};
