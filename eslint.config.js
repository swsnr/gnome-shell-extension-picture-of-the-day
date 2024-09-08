// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0.If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginPromise from "eslint-plugin-promise";

import gjsGuide from "./eslint.config.gjs-guide.js";

// Consider eslint-plugin-promise again once it supports flat config,
// see https://github.com/eslint-community/eslint-plugin-promise/issues/449

export default tseslint.config(
  // See https://typescript-eslint.io/getting-started
  eslint.configs.recommended,
  ...gjsGuide,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  // See https://typescript-eslint.io/getting-started/typed-linting
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        // @ts-ignore
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // See https://github.com/eslint-community/eslint-plugin-promise?tab=readme-ov-file#usage
  pluginPromise.configs["flat/recommended"],
  // See https://github.com/prettier/eslint-config-prettier?tab=readme-ov-file#installation
  eslintConfigPrettier,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      // .eslintrc.gjs-guide.yml enables this, but it has no use in typescript
      // which ensures a consistent return value through its type checks.
      "consistent-return": "off",
    },
  },
  // Global ignores, see https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores
  // "ignores" must be the _only_ key in this object!
  {
    ignores: [
      // eslint configs
      "eslint.config.*",
      // Build outputs
      "build/**/*",
      "dist/**/*",
      // Packages
      "node_modules/**",
      // Vendored dependencies
      "src/lib/vendor/**",
      // Scripts in deno
      "scripts/scrape-stalenhag.ts",
    ],
  },
);
