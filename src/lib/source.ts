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

import { SourceMetadata } from "./source/metadata.js";
import { DownloadableImage } from "./util/download.js";

export type { SourceMetadata } from "./source/metadata.js";

/**
 * Metadata of a downloaded image.
 *
 * This metadata contain plain data types in all leaf properties, to maintain
 * JSON compatibility, because various parts of this extension may serialize
 * and deserialize metadata for storage.
 */
export interface ImageMetadata {
  /**
   * The image title.
   */
  readonly title: string;

  /**
   * The image description.
   */
  readonly description: string | null;

  /**
   * Cpoyright information, if the image is not public domain.
   */
  readonly copyright: string | null;

  /**
   * Direct URL for this image.
   */
  readonly url: string | null;
}

/**
 * A function to get information about an image of the day.
 *
 * @param session The Soup session to use for making HTTP requests
 * @param cancellable Used to cancel any ongoing IO operations.
 * @returns A promise with metadata about an image being available for download.
 */
export type GetImage = (
  session: Soup.Session,
  cancellable: Gio.Cancellable,
) => Promise<DownloadableImage>;

/**
 * A simple function which requires no settings.
 */
export interface SimpleGetImage {
  readonly type: "simple";

  readonly getImage: GetImage;
}

/**
 * A factory to create a function to get images.
 */
export interface GetImageWithSettings {
  readonly type: "needs_settings";
  readonly create: (settings: Gio.Settings) => GetImage;
}

export type GetImageFactory = SimpleGetImage | GetImageWithSettings;

/**
 * An image source.
 */
export interface Source {
  /**
   * The metadata for this source.
   */
  readonly metadata: SourceMetadata;

  /**
   * Create a downloader for images of this source.
   */
  readonly getImage: GetImageFactory;
}
