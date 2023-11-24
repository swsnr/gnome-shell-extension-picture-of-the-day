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

import { ExtensionMetadata } from "resource:///org/gnome/shell/extensions/extension.js";

import {
  DownloadImage,
  ImageFile,
  SimpleDownloadImageFactory,
  Source,
} from "../source.js";
import { createSession, getJSON } from "../network/http.js";
import { DownloadableImage, downloadImage } from "../util/download.js";
import metadata from "./metadata/wikimedia.js";

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
  readonly type: string;
}

interface FeaturedImageDescription {
  readonly text: string;
}

interface FeaturedImage {
  readonly title: string;
  readonly image: FeaturedImageImage;
  readonly file_page: string;
  readonly artist: FeaturedImageArtist;
  readonly credit: FeaturedImageCredit;
  readonly license: FeaturedImageLicense;
  readonly description: FeaturedImageDescription;
}

interface FeaturedContentResponse {
  readonly image: FeaturedImage;
}

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

const getLatestImage = async (
  session: Soup.Session,
  cancellable: Gio.Cancellable,
): Promise<DownloadableImage> => {
  const date = GLib.DateTime.new_now_local();
  const featuredContent = await getFeaturedContent(session, date, cancellable);
  const { artist, license, description, file_page, image, title } =
    featuredContent.image;
  const pubdate = date.format("%Y-%m-%d");
  if (pubdate === null) {
    throw new Error(`Formatting GLib.DateTime returned null?`);
  }
  return {
    imageUrl: image.source,
    pubdate,
    metadata: {
      // Drop File: prefix and file extension from image title.
      title: title.replaceAll(/(^File:|.[^.]+$)/g, ""),
      description: description.text,
      copyright: `${artist.text} (${artist.text}, ${license.type})`,
      url: file_page,
    },
  };
};

export const downloadFactory: SimpleDownloadImageFactory = {
  type: "simple",
  create(
    extensionMetadata: ExtensionMetadata,
    downloadDirectory: Gio.File,
  ): DownloadImage {
    const session = createSession(extensionMetadata);

    return async (cancellable: Gio.Cancellable): Promise<ImageFile> => {
      const image = await getLatestImage(session, cancellable);
      return downloadImage(session, downloadDirectory, cancellable, image);
    };
  },
};

/**
 * A source for images from Wikimedia.
 */
export const source: Source = {
  metadata,
  downloadFactory,
};

export default source;
