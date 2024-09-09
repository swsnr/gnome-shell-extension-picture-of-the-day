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
import type { ImageMetadata } from "../source/source.js";
import type { ImageFile } from "../download.js";

interface StoredMetadata {
  readonly metadata: ImageMetadata;
  readonly uri: string;
}

const isStoredMetadata = (value: unknown): value is StoredMetadata => {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, "uri") &&
    typeof (value as Record<string, unknown>)["uri"] === "string" &&
    Object.hasOwn(value, "metadata") &&
    Object.hasOwn(
      (value as Record<string, unknown>)["metadata"] as object,
      "title",
    )
  );
};

const parseStoredMetadata = (value: string): StoredMetadata | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (isStoredMetadata(parsed)) {
      return parsed;
    } else {
      console.warn("Stored metadata not valid", parsed);
      return null;
    }
  } catch (error) {
    console.warn("Failed to parse stored metadata", value, error);
    return null;
  }
};

/**
 * Store the metadata for the current image.
 */
export class ImageMetadataStore {
  /**
   * Create a new store.
   *
   * @param settings The settings to store the image metadata in
   */
  constructor(private readonly settings: Gio.Settings) {}

  /**
   * Store metadata for the given image.
   */
  storedMetadataForImage(image: ImageFile) {
    const stored: StoredMetadata = {
      metadata: image.metadata,
      uri: image.file.get_uri(),
    };
    this.settings.set_string("current-metadata", JSON.stringify(stored));
  }

  /**
   * Load the current image from the metadata store.
   *
   * @returns The stored image or null if no image was stored or the store was invalid
   */
  loadFromMetadata(): ImageFile | null {
    const stored = parseStoredMetadata(
      this.settings.get_string("current-metadata"),
    );
    if (stored !== null) {
      return {
        metadata: stored.metadata,
        file: Gio.File.new_for_uri(stored.uri),
      };
    } else {
      return null;
    }
  }
}
