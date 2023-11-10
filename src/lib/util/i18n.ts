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

/**
 * Dynamically format `args` into `s`, for i18n purposes.
 *
 * Isolate the sorry state of dynamic string formatting in Gjs (Format all out deprecated,
 * flagged in reviews, no actual replacement in sight) into a single function,
 * so that we hopefully only need to change a single place to change should GJs
 * ever figure out how they'd like to have this done.
 */
export const format = (s: string, ...args: unknown[]): string =>
  s.format(...args);

export default {
  format,
};
