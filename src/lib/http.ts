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

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Soup from "gi://Soup";

import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

/**
 * A non-200 status code.
 */
export class HttpError extends Error {
  constructor(
    /** The status */
    readonly status: Soup.Status,
    /** The status reason. */
    readonly reason?: string | null,
  ) {
    super(_(`Request failed with HTTP status ${status} ${reason ?? ""}`));
  }
}

/**
 * Download a URL to a file.
 *
 * @param session The session to use.
 * @param url The URL to download.
 * @param target The target file.
 * @param cancellable Cancel the ongoing download.
 */
export const downloadToFile = async (
  session: Soup.Session,
  url: string,
  target: Gio.File,
  cancellable: Gio.Cancellable,
): Promise<void> => {
  if (target.query_exists(cancellable)) {
    // TODO: Make this a lot smarter: Make a HEAD preflight request and only download if size doesn't match content-length?
    return;
  }
  const message = Soup.Message.new("GET", url);
  const source = await session.send_async(message, 0, cancellable);
  if (message.get_status() !== Soup.Status.OK) {
    throw new HttpError(message.get_status(), message.get_reason_phrase());
  }
  // TODO: We should make this async, but there's no async equivalent…
  try {
    target.get_parent()?.make_directory_with_parents(cancellable);
  } catch (error) {
    // We've to cast around here because the type signature of `matches` doesn't allow for enums…
    if (
      !(
        error instanceof GLib.Error &&
        error.matches(
          Gio.IOErrorEnum as unknown as number,
          Gio.IOErrorEnum.EXISTS,
        )
      )
    ) {
      throw error;
    }
  }
  const sink = await target.create_async(Gio.FileCreateFlags.NONE, 0, null);
  await sink.splice_async(
    source,
    Gio.OutputStreamSpliceFlags.CLOSE_SOURCE |
      Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
    0,
    cancellable,
  );
};
