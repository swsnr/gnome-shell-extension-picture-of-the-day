// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0.If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Alternatively, the contents of this file may be used under the terms
// of the GNU General Public License Version 2 or later, as described below:
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

/* eslint-disable @typescript-eslint/triple-slash-reference */

/// <reference path="../../node_modules/@girs/gjs/gjs.d.ts" />
/// <reference path="../../node_modules/@girs/gjs/dom.d.ts" />
/// <reference path="../../node_modules/@girs/soup-3.0/soup-3.0-ambient.d.ts" />

interface String {
  // GNOME Shell pollutes the String prototype with its own format function
  format(...args: unknown[]): string;
}

interface ImportMeta {
  /** GNOME Shell/GJS add the imported URL here */
  readonly url: string;
}
