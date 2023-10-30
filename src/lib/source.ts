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

/**
 * A downloaded image.
 */
export interface Image {
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
export type DownloadImage = (cancellable: Gio.Cancellable) => Promise<Image>;

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
 * @param settings The settings for this source.
 * @param targetDirectory The target directory to download the image to.
 */
export type DownloadImageFactory = (
  settings: Gio.Settings,
  directories: DownloadDirectories,
) => DownloadImage;

/**
 * An abstract interface for a source of a picture of the day.
 */
export interface SourceMetadata {
  /**
   * The internal key for this source.
   *
   * Used mainly in settings.
   */
  readonly key: string;

  /**
   * The human readable name for this source.
   */
  readonly name: string;

  /**
   * The URL for the website of this source.
   */
  readonly website: string;
}

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
