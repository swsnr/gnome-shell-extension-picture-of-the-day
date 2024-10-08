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

import type { Source } from "../source/source.js";
import {
  NotAnImageError,
  InvalidAPIKeyError,
  RateLimitedError,
} from "../source/errors.js";
import { QueryList, encodeQuery } from "../network/uri.js";
import { HttpRequestError, HttpStatusError, getJSON } from "../network/http.js";
import metadata from "./metadata/apod.js";
import type { DownloadableImage } from "../download.js";

/**
 * The APOD API did not return any body data.
 */
export class ApodErrorDataMissing extends Error {
  constructor() {
    super("Response returned no data");
  }
}

/**
 * The APOD API returned a non-200 response and provided a detailed error response.
 */
export class ApodError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

// See https://github.com/nasa/apod-api#endpoint-versionapod
interface ApodMetadata {
  readonly resource: Record<string, string>;
  readonly title: string;
  readonly date: string;
  readonly url: string;
  readonly hdurl?: string | null;
  readonly media_type: string;
  readonly explanation: string;
  readonly copyright?: string | null;
}

interface ApodErrorDetails {
  readonly code: string;
  readonly message: string;
}

interface ApodErrorBody {
  readonly error: ApodErrorDetails;
}

/**
 * Whether a value is a error response body from the APOD API.
 *
 * @param value The value to check
 * @returns true if value denotes an APOD error response, false otherwise
 */
const isApodErrorBody = (value: unknown): value is ApodErrorBody => {
  if (value && typeof value === "object" && Object.hasOwn(value, "error")) {
    const details = (value as Record<string, unknown>)["error"] as
      | Record<string, unknown>
      | null
      | undefined;
    return (
      details !== null &&
      typeof details === "object" &&
      typeof details["code"] === "string" &&
      typeof details["message"] === "string"
    );
  } else {
    return false;
  }
};

/**
 * Query the metadata for todays image.
 *
 * @param session The HTTP session to use
 * @param apiKey The API key
 * @param cancellable The handle to cancel any IO operation
 * @returns The metadata for todays image.
 */
const queryMetadata = async (
  session: Soup.Session,
  apiKey: string,
  cancellable: Gio.Cancellable,
): Promise<ApodMetadata> => {
  const query: QueryList = [["api_key", apiKey]];
  const url = `https://api.nasa.gov/planetary/apod?${encodeQuery(query)}`;
  console.log(`Querying APOD image metadata from ${url}`);
  try {
    const response = await getJSON(session, url, cancellable);
    return response as ApodMetadata;
  } catch (error) {
    // Check if the API gave us a more specific response
    if (
      error instanceof HttpRequestError &&
      error.cause instanceof HttpStatusError &&
      error.cause.body
    ) {
      let body = undefined;
      try {
        body = JSON.parse(
          new TextDecoder().decode(error.cause.body),
        ) as unknown;
      } catch {
        body = undefined;
      }
      if (body && isApodErrorBody(body)) {
        const apodError = new ApodError(body.error.code, body.error.message, {
          cause: error,
        });
        switch (body.error.code) {
          case "API_KEY_INVALID":
            throw new InvalidAPIKeyError(metadata, { cause: apodError });
          case "OVER_RATE_LIMIT":
            throw new RateLimitedError("Request rejected due to rate limit", {
              cause: apodError,
            });
          default:
            throw apodError;
        }
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }
};

/**
 * Get today's APOD image.
 *
 * @param settings Settings to get the API key from.
 * @param session The HTTP client to use
 * @param cancellable To cancel the ongoing download
 * @returns Todays APOD
 */
const getImage = async (
  settings: Gio.Settings,
  session: Soup.Session,
  cancellable: Gio.Cancellable,
): Promise<DownloadableImage> => {
  const apiKey = settings.get_string("api-key");
  if (apiKey.length === 0) {
    throw new InvalidAPIKeyError(metadata);
  }

  const apodImageMetadata = await queryMetadata(session, apiKey, cancellable);
  const urlDate = apodImageMetadata.date.replaceAll("-", "").slice(2);
  const url = `https://apod.nasa.gov/apod/ap${urlDate}.html`;
  const downloadableImage: DownloadableImage = {
    imageUrl: apodImageMetadata.hdurl ?? apodImageMetadata.url,
    pubdate: apodImageMetadata.date,
    metadata: {
      title: apodImageMetadata.title,
      description: apodImageMetadata.explanation,
      url,
      copyright: apodImageMetadata.copyright ?? null,
    },
  };

  if (apodImageMetadata.media_type !== "image") {
    throw new NotAnImageError(
      downloadableImage.metadata,
      apodImageMetadata.media_type,
    );
  }

  return downloadableImage;
};

/**
 * A source for images from APOD.
 */
export const source: Source = {
  metadata,
  getImages: {
    type: "needs_settings",
    create:
      (settings: Gio.Settings) =>
      async (
        session: Soup.Session,
        cancellable: Gio.Cancellable,
      ): Promise<readonly DownloadableImage[]> => {
        return [await getImage(settings, session, cancellable)];
      },
  },
};

export default source;
