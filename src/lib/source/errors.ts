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

import { ImageMetadata, SourceMetadata } from "./source.js";

/**
 * An error denoting a wrong configuration for a source.
 */
export abstract class ConfigurationError extends Error {
  /**
   * Create a new error.
   *
   * @param metadata The metadata of the source which triggered this error.
   * @param message The error message.
   */
  constructor(
    readonly metadata: SourceMetadata,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/**
 * No valid API was configured, or the API was rejected by the remote side.
 */
export class InvalidAPIKeyError extends ConfigurationError {
  constructor(metadata: SourceMetadata, options?: ErrorOptions) {
    super(metadata, `API key invalid for ${metadata.key}`, options);
  }
}

/**
 * Today's picture was not a picture, but some other media, e.g. an image.
 */
export class NotAnImageError extends Error {
  constructor(
    readonly metadata: ImageMetadata,
    readonly mediaType: string,
    options?: ErrorOptions,
  ) {
    super(`Media type not supported: %s`, options);
  }
}

/**
 * The given source did not provide a picture today
 */
export class NoPictureTodayError extends Error {
  constructor(
    readonly source: SourceMetadata,
    options?: ErrorOptions,
  ) {
    super(`${source.name} does not provide a picture today`, options);
  }
}

/**
 * The provider of today's image has rate limited the current client.
 */
export class RateLimitedError extends Error {}
