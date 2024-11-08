// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0.If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// @ts-check

import gsebuild from "@swsnr/gsebuild/eslint";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  ...gsebuild.configs.typescript,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        // @ts-ignore
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // See https://github.com/prettier/eslint-config-prettier?tab=readme-ov-file#installation
  eslintConfigPrettier,
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
