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

import type { DownloadableImage } from "../download.js";
import type { Source } from "../source/source.js";
import metadata from "./metadata/stalenhag.js";
import type { PromisifiedGioFile } from "../fixes.js";

export interface Collection {
  readonly tag: string;
  readonly title: string;
}

export interface Image {
  readonly src: string;
}

export interface ImageCollection extends Collection {
  readonly images: readonly Image[];
  readonly url: string;
}

interface ImageInCollection extends Image {
  readonly collection: ImageCollection;
}

/**
 * Load the Stalenhag image collectsion from our data file.
 *
 * The data file is generated by scraping the site, see `scripts/scrape-stalenhag.ts`.
 *
 * @returns All image image collections tracked in our data file
 */
export const loadImageCollections = async (): Promise<
  readonly ImageCollection[]
> => {
  const dataFile = Gio.File.new_for_uri(
    GLib.Uri.resolve_relative(
      import.meta.url,
      "stalenhag.json",
      GLib.UriFlags.NONE,
    ),
  );
  const [contents] = await (dataFile as PromisifiedGioFile).load_contents_async(
    null,
  );
  return JSON.parse(
    new TextDecoder().decode(contents),
  ) as readonly ImageCollection[];
};

/**
 * Convert microseconds to days.
 *
 * @param musec A timespan in microseconds
 * @returns The timestamp rounded to full days.
 */
const toDays = (musec: number): number =>
  Math.round(
    musec /
      1000 / // milliseconds
      1000 / // seconds
      60 / // minutes
      60 / // hours
      24, //days
  );

/**
 * Pick an image from today from the given list of images.
 *
 * Computes the number of days between today and some base date, and pick an
 * image of this ring.
 *
 * @param allImages All images
 * @returns The image to show today.
 */
const pickTodaysImage = (allImages: ImageInCollection[]): DownloadableImage => {
  // The 84th anniversary of Georg Elsner's heroic act of resistance against the nazi regime
  const baseDate = GLib.DateTime.new_local(2023, 11, 8, 21, 20, 0);
  const now = GLib.DateTime.new_now_local();
  const offsetInDays = toDays(now.difference(baseDate));
  const image = allImages[offsetInDays % allImages.length];
  if (!image) {
    throw new Error("You got this calculation wrong!");
  }
  const baseName = image.src.split("/").at(-1);
  if (!baseName) {
    throw new Error(`Failed to extract filename from URL ${image.src}`);
  }
  return {
    imageUrl: image.src,
    suggestedFilename: `${image.collection.tag}-${baseName}`,
    // We do not add a date to the image here, because we cycle through these
    // images and will eventually hit this image again.
    pubdate: null,
    metadata: {
      title: baseName.replace(/.[^.]+$/, ""),
      description: null,
      copyright: "All rights reserved.",
      url: image.collection.url,
    },
  };
};

export const source: Source = {
  metadata,
  getImages: {
    type: "needs_settings",
    create: (settings: Gio.Settings) => {
      return async (): Promise<readonly DownloadableImage[]> => {
        const disabledCollections = new Set(
          settings.get_strv("disabled-collections"),
        );
        const allImages = (await loadImageCollections())
          .filter((collection) => !disabledCollections.has(collection.tag))
          .flatMap((collection) =>
            collection.images.map((image) => ({ collection, ...image })),
          );
        return [pickTodaysImage(allImages)];
      };
    },
  },
};

export default source;
