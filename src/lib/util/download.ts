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

import { DownloadDirectories, ImageFile, ImageMetadata } from "../source.js";
import { downloadToFile } from "../network/http.js";

/**
 * An image available for download.
 */
export interface DownloadableImage {
  /**
   * The metadata of this image.
   */
  readonly metadata: ImageMetadata;
  /**
   * The URL to download this image from.
   */
  readonly imageUrl: string;
  /**
   * The date this image was published at, as YYYY-MM-DD
   */
  readonly pubdate: string;
}

const guessFilename = (image: DownloadableImage): string => {
  const urlBasename = image.imageUrl.split("/").reverse()[0];
  return urlBasename && 0 < urlBasename.length
    ? urlBasename
    : image.metadata.title.replaceAll(/\/|\n/g, "_");
};

/**
 * Download an image.
 *
 * Automatically determine a useful filename for the image from the pub date and
 * the title, and download the image to that file.
 *
 * @param session The HTTP session to use
 * @param directories The download directories
 * @param cancellable Cancel the download
 * @param image The image to download
 * @param title If given the title to use, instead of the URL basename or the
 */
export const downloadImage = async (
  session: Soup.Session,
  directories: DownloadDirectories,
  cancellable: Gio.Cancellable,
  image: DownloadableImage,
  title?: string,
): Promise<ImageFile> => {
  // Replace directory separators and new lines in the file name.
  const filename = title ?? guessFilename(image);
  const targetFile = directories.imageDirectory.get_child(
    `${image.pubdate}-${filename}`,
  );
  console.log(
    `Downloading image from ${image.imageUrl} to ${targetFile.get_path()}`,
  );
  await downloadToFile(session, image.imageUrl, targetFile, cancellable);
  return {
    file: targetFile,
    metadata: image.metadata,
  };
};
