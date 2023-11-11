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
  ignorePatterns: [
    // Build outputs
    "/build/**/*",
    "/dist/**/*",
    // NPM modules
    "/node_modules/**/*",
    // Generated code
    "/@types/gir-generated/**/*",
    // Vendored dependencies
    "/src/lib/vendor/**",
  ],
};
