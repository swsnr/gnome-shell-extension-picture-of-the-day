module.exports = {
  extends: [
    "eslint:recommended",
    ".eslintrc.gjs-guide.yml",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:promise/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    // See https://typescript-eslint.io/linting/typed-linting
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint", "promise"],
  root: true,
  rules: {
    "@typescript-eslint/no-shadow": "warn",
  },
  // These are either generated or config files or no real typescript
  ignorePatterns: [
    "/build/**/*",
    "/dist/**/*",
    "/node_modules/**/*",
    "/@types/gir-generated/**/*",
  ],
};
