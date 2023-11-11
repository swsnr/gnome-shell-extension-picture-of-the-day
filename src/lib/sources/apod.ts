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

import { ExtensionMetadata } from "resource:///org/gnome/shell/extensions/extension.js";

import {
  DownloadDirectories,
  DownloadImage,
  DownloadImageFactoryWithSettings,
  ImageFile,
  ImageMetadata,
  Source,
} from "../source.js";
import {
  NotAnImageError,
  InvalidAPIKeyError,
  RateLimitedError,
} from "../source/errors.js";
import { QueryList, encodeQuery } from "../network/uri.js";
import {
  HttpRequestError,
  HttpStatusError,
  createSession,
  downloadToFile,
  getJSON,
} from "../network/http.js";
import metadata from "./metadata/apod.js";

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

export const downloadFactory: DownloadImageFactoryWithSettings = {
  type: "needs_settings",
  create(
    extensionMetadata: ExtensionMetadata,
    settings: Gio.Settings,
    directories: DownloadDirectories,
  ): DownloadImage {
    const session = createSession(extensionMetadata);

    return async (cancellable: Gio.Cancellable): Promise<ImageFile> => {
      const apiKey = settings.get_string("api-key");
      if (apiKey === null || apiKey.length === 0) {
        throw new InvalidAPIKeyError(metadata);
      }

      const apodImageMetadata = await queryMetadata(
        session,
        apiKey,
        cancellable,
      );
      const urlDate = apodImageMetadata.date.replaceAll("-", "").slice(2);
      const url = `https://apod.nasa.gov/apod/ap${urlDate}.html`;
      const imageMetadata: ImageMetadata = {
        title: apodImageMetadata.title,
        description: apodImageMetadata.explanation,
        url,
        copyright: apodImageMetadata.copyright ?? null,
      };
      if (apodImageMetadata.media_type !== "image") {
        throw new NotAnImageError(imageMetadata, apodImageMetadata.media_type);
      }

      const imageUrl = apodImageMetadata.hdurl ?? apodImageMetadata.url;
      const urlBasename = imageUrl.split("/").reverse()[0];
      const filename =
        urlBasename && 0 < urlBasename.length
          ? urlBasename
          : apodImageMetadata.title.replaceAll(/\/|\n/, "_");
      const targetFile = directories.imageDirectory.get_child(
        `${apodImageMetadata.date}-${filename}`,
      );
      console.log(
        `Downloading APOD image from ${imageUrl} to ${targetFile.get_path()}`,
      );
      await downloadToFile(session, imageUrl, targetFile, cancellable);

      return {
        file: targetFile,
        metadata: imageMetadata,
      };
    };
  },
};

/**
 * A source for images from APOD.
 */
export const source: Source = {
  metadata,
  downloadFactory,
};

export default source;
