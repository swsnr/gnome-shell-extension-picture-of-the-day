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
 */
export const downloadToFile = async (session: Soup.Session, url: string, target: Gio.File): Promise<void> => {
    const message = new Soup.Message("GET", url);
    const source = await session.send_async(message, 0, null);
    if (message.get_status() !== Soup.Status.OK) {
        throw new HttpError(message.get_status(), message.get_reason_phrase());
    }
    const sink = await target.create_async(Gio.FileCreateFlags.NONE, 0, null);
    await sink.splice_async(source, Gio.OutputStreamSpliceFlags.CLOSE_SOURCE | Gio.OutputStreamSpliceFlags.CLOSE_TARGET, 0, null);
}
