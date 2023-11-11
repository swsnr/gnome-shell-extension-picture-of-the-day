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

/**
 * The type of a query as list of pairs.
 */
export type QueryList = readonly [string, string][];

/**
 * Create a query string out of query parts.
 *
 * @param query The query parameters to encode.
 * @returns The encoded query.
 */
export const encodeQuery = (query: QueryList): string => {
  const parts = [];
  for (const [key, value] of query) {
    parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  return parts.join("&");
};

export class UriError extends Error {}

/**
 * Decode the query string of an URL.
 *
 * @param url The URL whose query parameters to parse
 * @returns The query parameters
 */
export const decodeQuery = (url: string): Record<string, string> => {
  try {
    const query = GLib.Uri.parse(url, GLib.UriFlags.NONE).get_query();
    if (!query) {
      return {};
    } else {
      return GLib.Uri.parse_params(
        query,
        -1,
        "&",
        GLib.UriParamsFlags.WWW_FORM,
      ) as Record<string, string>;
    }
  } catch (cause) {
    throw new UriError(`Failed to parse query out of ${url}`, { cause });
  }
};
