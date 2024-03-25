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
    // .eslintrc.gjs-guide.yml enables this, but it has no use in typescript
    // which ensures a consistent return value through its type checks.
    "consistent-return": "off",
  },
  ignorePatterns: [
    // Build outputs
    "/build/**/*",
    "/dist/**/*",
    // Packages
    "/node_modules/**",
    // Vendored dependencies
    "/src/lib/vendor/**",
  ],
};
