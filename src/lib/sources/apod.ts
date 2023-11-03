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

import {
  ExtensionMetadata,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";

import {
  DownloadDirectories,
  DownloadImageFactory,
  ImageFile,
  Source,
} from "../source.js";
import { ConfigurationError } from "../util/configuration.js";
import { QueryList, encodeQuery } from "../network/uri.js";
import { HttpError, downloadToFile } from "../network/http.js";
import metadata from "./metadata/apod.js";

// eslint-disable-next-line no-restricted-properties
const vprintf = imports.format.vprintf;

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
  ) {
    super(message);
  }
}

export class UnsupportedMediaType extends Error {
  constructor(readonly mediaType: string) {
    super(vprintf(_(`Media type not supported: %s`), [mediaType]));
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
  const message = Soup.Message.new("GET", url);
  const response = await session.send_and_read_async(message, 0, cancellable);
  const data = response.get_data();
  if (message.get_status() === Soup.Status.OK) {
    if (data === null) {
      throw new ApodErrorDataMissing();
    }
    return JSON.parse(new TextDecoder().decode(data)) as ApodMetadata;
  } else {
    if (data === null) {
      throw new HttpError(message.get_status(), message.get_reason_phrase());
    } else {
      const body = JSON.parse(new TextDecoder().decode(data)) as unknown;
      if (isApodErrorBody(body)) {
        throw new ApodError(body.error.code, body.error.message);
      } else {
        throw new HttpError(message.get_status(), message.get_reason_phrase());
      }
    }
  }
};

/**
 * Create a downloader for APOD.
 *
 * @param settings The settings for this source.
 * @param directories Directories this source may use.
 * @returns A download function
 */
const createDownloader: DownloadImageFactory = (
  extensionMetadata: ExtensionMetadata,
  settings: Gio.Settings,
  directories: DownloadDirectories,
) => {
  const version = extensionMetadata["version-name"] ?? "n/a";
  const session = new Soup.Session({
    user_agent: `${extensionMetadata.uuid}/${version} GNOME Shell extension`,
  });

  return async (cancellable: Gio.Cancellable): Promise<ImageFile> => {
    const apiKey = settings.get_string("api-key");
    if (apiKey === null || apiKey.length === 0) {
      throw new ConfigurationError(
        metadata,
        _(
          "Please configure an API key for the NASA Astronomy Picture of the Day in the extension settings.",
        ),
      );
    }

    const imageMetadata = await queryMetadata(session, apiKey, cancellable);
    if (imageMetadata.media_type !== "image") {
      throw new UnsupportedMediaType(imageMetadata.media_type);
    }

    const imageUrl = imageMetadata.hdurl ?? imageMetadata.url;
    const urlBasename = imageUrl.split("/").reverse()[0];
    const filename =
      urlBasename && 0 < urlBasename.length
        ? urlBasename
        : imageMetadata.title.replaceAll(/\/|\n/, "_");
    const targetFile = directories.imageDirectory.get_child(
      `${imageMetadata.date}-${filename}`,
    );
    await downloadToFile(session, imageUrl, targetFile, cancellable);
    const urlDate = imageMetadata.date.replaceAll("-", "").slice(2);
    const url = `https://apod.nasa.gov/apod/ap${urlDate}.html`;
    return {
      file: targetFile,
      metadata: {
        title: imageMetadata.title,
        description: imageMetadata.explanation,
        url,
        copyright: imageMetadata.copyright ?? null,
      },
    };
  };
};

/**
 * A source for images from APOD.
 */
export const source: Source = {
  metadata,
  createDownloader,
};

export default source;
