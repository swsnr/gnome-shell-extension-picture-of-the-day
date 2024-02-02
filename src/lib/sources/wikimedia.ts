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

import { Source } from "../source.js";
import { getJSON } from "../network/http.js";
import { DownloadableImage } from "../download.js";
import metadata from "./metadata/wikimedia.js";
import { NoPictureTodayError } from "../source/errors.js";

interface FeaturedImageImage {
  readonly source: string;
}

interface FeaturedImageArtist {
  readonly text: string;
}

interface FeaturedImageCredit {
  readonly text: string;
}

interface FeaturedImageLicense {
  readonly type?: string | null;
}

interface FeaturedImageDescription {
  readonly text: string;
}

interface FeaturedImage {
  readonly title: string;
  readonly image: FeaturedImageImage;
  readonly file_page: string;
  readonly artist?: FeaturedImageArtist | null;
  readonly credit?: FeaturedImageCredit | null;
  readonly license?: FeaturedImageLicense | null;
  readonly description: FeaturedImageDescription;
}

interface FeaturedContentResponse {
  readonly image?: FeaturedImage | null;
}

/**
 * Assemble a copyright description from the image metadata.
 *
 * @param image The featured imaged
 */
const getCopyrightText = (image: FeaturedImage): string => {
  const { artist, license, credit } = image;
  if (artist?.text && license?.type && credit?.text) {
    return `${artist.text} (${credit.text}, ${license.type})`;
  } else if (artist?.text && license?.type) {
    return `${artist.text} (${license.type})`;
  } else if (artist?.text) {
    return artist.text;
  } else if (license?.type) {
    return license.type;
  } else {
    // We do not know anything about the copyright here, so let's default to
    // some "all rights reserved" blurp.
    return _("Unknown, all rights reserved");
  }
};

const getFeaturedContent = async (
  session: Soup.Session,
  date: GLib.DateTime,
  cancellable: Gio.Cancellable,
): Promise<FeaturedContentResponse> => {
  // Extract the language code from the locale, and fall back to English.
  const locales = GLib.get_language_names_with_category("LC_MESSAGES");
  const languageCode = locales[0]?.split("_")[0] ?? "en";
  const urlDate = date.format("%Y/%m/%d");
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/${languageCode}/featured/${urlDate}`;
  console.log(`Fetching featured content from ${url}`);
  const response = await getJSON(session, url, cancellable);
  return response as FeaturedContentResponse;
};

const getImages = async (
  session: Soup.Session,
  cancellable: Gio.Cancellable,
): Promise<readonly DownloadableImage[]> => {
  const date = GLib.DateTime.new_now_local();
  const featuredContent = await getFeaturedContent(session, date, cancellable);
  if (!featuredContent.image) {
    throw new NoPictureTodayError(metadata);
  }
  const { description, file_page, image, title } = featuredContent.image;
  const pubdate = date.format("%Y-%m-%d");
  if (pubdate === null) {
    throw new Error(`Formatting GLib.DateTime returned null?`);
  }
  const copyright = getCopyrightText(featuredContent.image);
  const imageToDownload: DownloadableImage = {
    imageUrl: image.source,
    pubdate,
    metadata: {
      // Drop File: prefix and file extension from image title.
      title: title.replaceAll(/(^File:|.[^.]+$)/g, ""),
      description: description.text,
      copyright,
      url: file_page,
    },
  };
  return [imageToDownload];
};

/**
 * A source for images from Wikimedia.
 */
export const source: Source = {
  metadata,
  getImages: {
    type: "simple",
    getImages,
  },
};

export default source;
