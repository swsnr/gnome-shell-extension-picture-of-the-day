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

import type GLib from "gi://GLib";
import type Gio from "gi://Gio";
import type Soup from "gi://Soup";

/**
 * This module provides workarounds and fixes for various incomplete type
 * declarations in Gnome shell types and its dependencies.
 */

/**
 * @see https://github.com/gjsify/ts-for-gir/issues/196
 */
export interface GLibErrorWithStack extends GLib.Error {
  readonly stack: string;
}

/**
 * @see https://github.com/gjsify/ts-for-gir/issues/171#issuecomment-2117301067
 */
export interface PromisifiedFileOutputStream extends Gio.FileOutputStream {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  splice_async(
    source: Gio.InputStream,
    flags: Gio.OutputStreamSpliceFlags,
    io_priority: number,
    cancellable?: Gio.Cancellable | null,
  ): Promise<ReturnType<Gio.OutputStream["splice_finish"]>>;
}

/**
 * @see https://github.com/gjsify/ts-for-gir/issues/171#issuecomment-2117301067
 */
export interface PromisifiedGioFile extends Gio.File {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  create_async(
    flags: Gio.FileCreateFlags,
    io_priority: number,
    cancellable?: Gio.Cancellable | null,
  ): Promise<ReturnType<Gio.File["create_finish"]>>;

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  delete_async(
    io_priority: number,
    cancellable?: Gio.Cancellable | null,
  ): Promise<ReturnType<Gio.File["delete_finish"]>>;
}

/**
 * @see https://github.com/gjsify/ts-for-gir/issues/171#issuecomment-2117301067
 */
export interface PromisifiedSoupSession extends Soup.Session {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  send_async(
    msg: Soup.Message,
    io_priority: number,
    cancellable?: Gio.Cancellable | null,
  ): Promise<ReturnType<Soup.Session["send_finish"]>>;

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  send_and_read_async(
    msg: Soup.Message,
    io_priority: number,
    cancellable?: Gio.Cancellable | null,
  ): Promise<ReturnType<Soup.Session["send_and_read_finish"]>>;
}
