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

import { ExtensionMetadata } from "resource:///org/gnome/shell/extensions/extension.js";

import { SourceMetadata } from "./source/metadata.js";

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
 * A downloaded image.
 */
export interface ImageFile {
  /**
   * The metadata of this image.
   */
  readonly metadata: ImageMetadata;

  /**
   * The downloaded file.
   */
  readonly file: Gio.File;
}

/**
 * A function to download an image.
 *
 * @param cancellable Used to cancel any ongoing IO operations.
 */
export type DownloadImage = (
  cancellable: Gio.Cancellable,
) => Promise<ImageFile>;

/**
 * Directories where sources can store data.
 */
export interface DownloadDirectories {
  /**
   * The directory to cache ephemeral data in.
   */
  readonly cacheDirectory: Gio.File;

  /**
   * The directory for the actual images.
   *
   * This is a user-visible directory, e.g. under the user's image directory,
   * so it should only contain human readable data.
   */
  readonly imageDirectory: Gio.File;

  /**
   * The directory to store download state in.
   *
   * This directory
   */
  readonly stateDirectory: Gio.File;
}

/**
 * A factory for a download function.
 *
 * @param metadata Metadata about this extension, to use e.g. in User-Agent strings.
 * @param settings The settings for this source.
 * @param targetDirectory The target directory to download the image to.
 */
export type DownloadImageFactory = (
  extensionMetadata: ExtensionMetadata,
  settings: Gio.Settings,
  directories: DownloadDirectories,
) => DownloadImage;

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
  readonly createDownloader: DownloadImageFactory;
}
