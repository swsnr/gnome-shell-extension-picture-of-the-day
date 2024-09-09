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

import metadata from "./metadata/bing.js";
import type { Source } from "../source/source.js";
import { getJSON } from "../network/http.js";
import type { DownloadableImage } from "../download.js";
import { decodeQuery, encodeQuery } from "../network/uri.js";

interface BingImage {
  readonly title: string;
  readonly copyright: string;
  readonly copyrightlink: string;
  readonly startdate: string;
  readonly urlbase: string;
}

interface BingResponse {
  readonly images?: readonly BingImage[];
}

// See https://github.com/swsnr/gnome-shell-extension-picture-of-the-day/issues/27
const NUMBER_OF_IMAGES = 8;

export const getTodaysImages = async (
  session: Soup.Session,
  cancellable: Gio.Cancellable,
): Promise<readonly DownloadableImage[]> => {
  const queryList: [string, string][] = [
    ["format", "js"],
    ["idx", "0"],
    ["n", NUMBER_OF_IMAGES.toString()],
  ];
  // Bing has locale-dependent images; we take the current locale for this GNOME
  // shell process, and turn it into a format Bing understands (no encoding, and
  // no underscores).
  //
  // With an invalid locale bing seems to fall back to geo-IP, and return an
  // image for the geopgraphic location of the user.
  const locale = GLib.get_language_names_with_category("LC_MESSAGES")[0]
    ?.split(".")[0]
    ?.replaceAll("_", "-");
  if (locale) {
    queryList.push(["mkt", locale]);
  }
  const url = `https://www.bing.com/HPImageArchive.aspx?${encodeQuery(
    queryList,
  )}`;
  console.log(`Querying latest bing image from ${url}`);
  const response = (await getJSON(session, url, cancellable)) as BingResponse;
  const images = response.images ?? [];
  return images.map((image) => {
    const urlbaseUHD = `${image.urlbase}_UHD.jpg`;
    const imageUrl = GLib.uri_resolve_relative(
      "https://www.bing.com",
      urlbaseUHD,
      GLib.UriFlags.NONE,
    );
    const startdate = image.startdate;
    const suggestedFilename = decodeQuery(imageUrl)["id"];
    return {
      imageUrl: imageUrl,
      pubdate: `${startdate.slice(0, 4)}-${startdate.slice(
        4,
        6,
      )}-${startdate.slice(6)}`,
      suggestedFilename,
      metadata: {
        title: image.title,
        // The copyright fields really seem to be more of a description really
        url: image.copyrightlink,
        description: image.copyright,
        copyright: null,
      },
    };
  });
};

export const source: Source = {
  metadata,
  getImages: {
    type: "simple",
    getImages: async (
      session: Soup.Session,
      cancellable: Gio.Cancellable,
    ): Promise<readonly DownloadableImage[]> =>
      getTodaysImages(session, cancellable),
  },
};

export default source;
