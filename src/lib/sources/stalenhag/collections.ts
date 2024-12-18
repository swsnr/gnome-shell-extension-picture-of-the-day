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

// This module is imported from prefs as well as from the extension, so it must
// neither import Gtk nor any resource:// modules.

import GLib from "gi://GLib";
import Gio from "gi://Gio";

import collections from "./collections.json" with { type: "json" };

export type ImageCollections = typeof collections;

export type ImageCollection = ImageCollections[0];

export type Image = ImageCollection["images"][0];

/**
 * Load the Stalenhag image collectsion from our data file.
 *
 * The data file is generated by scraping the site, see `scripts/scrape-stalenhag.ts`.
 *
 * @returns All image image collections tracked in our data file
 */
export const loadImageCollections = async (): Promise<ImageCollections> => {
  const dataFile = Gio.File.new_for_uri(
    GLib.Uri.resolve_relative(
      import.meta.url,
      "collections.json",
      GLib.UriFlags.NONE,
    ),
  );
  const [contents] = await dataFile.load_contents_async(null);
  return JSON.parse(new TextDecoder().decode(contents)) as ImageCollections;
};
