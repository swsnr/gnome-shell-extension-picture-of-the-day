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
import Soup from "gi://Soup";
import { IOError } from "../util/gio.js";

import type { ExtensionMetadata } from "resource:///org/gnome/shell/extensions/extension.js";

export const createSession = (
  extensionMetadata: ExtensionMetadata,
): Soup.Session => {
  const version = extensionMetadata["version-name"] ?? "n/a";
  return new Soup.Session({
    user_agent: `${extensionMetadata.uuid}/${version} GNOME Shell extension`,
  });
};

/**
 * A non-200 status code.
 */
export class HttpStatusError extends Error {
  constructor(
    /** The status */
    readonly status: Soup.Status,
    /** The status reason. */
    readonly reason?: string | null,
    /** The body returned with the response */
    readonly body?: Uint8Array | null,
  ) {
    super(`HTTP request failed with HTTP status ${status} ${reason ?? ""}`);
  }
}

/**
 * No data in a response that was expected to have data.
 */
export class NoDataError extends Error {}

/**
 * An error which occurred while processing a HTTP request
 */
export class HttpRequestError extends Error {
  constructor(
    readonly url: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/**
 * Make a request and read a string response.
 *
 * @param session The HTTP session to use
 * @param url The URL to request from
 * @param cancellable A handle to cancel the IO operation
 * @returns The returned string
 */
export const getString = async (
  session: Soup.Session,
  url: string,
  cancellable: Gio.Cancellable,
): Promise<string> => {
  const message = Soup.Message.new("GET", url);
  const response = await session
    .send_and_read_async(message, 0, cancellable)
    .catch((cause: unknown) => {
      throw new HttpRequestError(url, `Failed to get data from ${url}`, {
        cause,
      });
    });
  const data = response.get_data();
  if (message.get_status() === Soup.Status.OK) {
    try {
      if (data === null || data.byteLength === 0) {
        throw new NoDataError(
          `Response with status code ${message.get_status()} contained no data`,
        );
      }
      return new TextDecoder().decode(data);
    } catch (cause) {
      throw new HttpRequestError(url, `Failed to decode data from ${url}`, {
        cause,
      });
    }
  } else {
    throw new HttpRequestError(
      url,
      `Request to ${url} received error response`,
      {
        cause: new HttpStatusError(
          message.get_status(),
          message.get_reason_phrase(),
        ),
      },
    );
  }
};

/**
 * Make a request and read a JSON response.
 *
 * @param session The HTTP session to use
 * @param url The URL to request from
 * @param cancellable A handle to cancel the IO operation
 * @returns The deserialized JSON data
 */
export const getJSON = async (
  session: Soup.Session,
  url: string,
  cancellable: Gio.Cancellable,
): Promise<unknown> => {
  const data = await getString(session, url, cancellable);
  try {
    return JSON.parse(data) as unknown;
  } catch (cause) {
    throw new HttpRequestError(url, `Failed to parse data from ${url}`, {
      cause,
    });
  }
};

/**
 * Download a URL to a file.
 *
 * @param session The session to use.
 * @param url The URL to download.
 * @param target The target file.
 * @param cancellable Cancel the ongoing download.
 */
export const downloadToFile = async (
  session: Soup.Session,
  url: string,
  target: Gio.File,
  cancellable: Gio.Cancellable,
): Promise<void> => {
  if (target.query_exists(cancellable)) {
    // TODO: Make this a lot smarter: Make a HEAD preflight request and only download if size doesn't match content-length?
    return;
  }
  const message = Soup.Message.new("GET", url);
  const source = await session
    .send_async(message, 0, cancellable)
    .catch((cause: unknown) => {
      throw new HttpRequestError(url, `Failed to make GET request to ${url}`, {
        cause,
      });
    });
  if (message.get_status() !== Soup.Status.OK) {
    throw new HttpRequestError(url, `GET request to ${url} returned error`, {
      cause: new HttpStatusError(
        message.get_status(),
        message.get_reason_phrase(),
      ),
    });
  }
  // TODO: We should make this async, but there's no async equivalent…
  const parentDirectory = target.get_parent();
  if (parentDirectory) {
    try {
      target.get_parent()?.make_directory_with_parents(cancellable);
    } catch (cause) {
      // If the directory already exists don't propagate the error
      //
      // We've to cast around here because the type signature of `matches` doesn't allow for enums…
      if (
        !(
          cause instanceof GLib.Error &&
          cause.matches(
            Gio.IOErrorEnum as unknown as number,
            Gio.IOErrorEnum.EXISTS,
          )
        )
      ) {
        throw new IOError(
          `Failed to create target directory at ${parentDirectory.get_path()} to download from ${url}`,
          { cause },
        );
      }
    }
  }
  const sink = await target
    .create_async(Gio.FileCreateFlags.NONE, 0, null)
    .catch((cause: unknown) => {
      throw new IOError(
        `Failed to open target file at ${target.get_path()} to download from ${url}`,
        { cause },
      );
    });
  await sink
    .splice_async(
      source,
      Gio.OutputStreamSpliceFlags.CLOSE_SOURCE |
        Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
      0,
      cancellable,
    )
    .catch((cause: unknown) => {
      throw new HttpRequestError(
        url,
        `Failed to download data from ${url} to ${target.get_path()}`,
        { cause },
      );
    });
};
