// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0.If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import tseslint from "typescript-eslint";

export default tseslint.config({
  extends: [],
  languageOptions: {
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
  linterOptions: {
    noInlineConfig: true,
  },
  rules: {
    "lines-between-class-members": ["error", "always"],
    "padding-line-between-statements": [
      "error",
      { blankLine: "always", prev: "*", next: "class" },
      { blankLine: "always", prev: "*", next: "function" },
      { blankLine: "always", prev: "*", next: "return" },
      { blankLine: "always", prev: "*", next: "export" },
      { blankLine: "always", prev: "*", next: "multiline-const" },
    ],
  },
});
