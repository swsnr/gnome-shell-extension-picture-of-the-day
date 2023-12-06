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

import { HttpRequestError, getString } from "../network/http.js";
import * as dom from "../util/simpledom.js";
import { Source } from "../source.js";
import metadata from "./metadata/eopod.js";
import { DownloadableImage } from "../util/download.js";

const findImgs = (nodes: readonly dom.Node[]): readonly dom.Element[] => {
  const elements = nodes.filter(dom.isElement);
  return elements
    .filter((n) => n.name === "img")
    .concat(elements.flatMap((e) => findImgs(e.children)));
};

const getImages = async (
  session: Soup.Session,
  cancellable: Gio.Cancellable,
): Promise<readonly DownloadableImage[]> => {
  const SaxesParser = (await import("../vendor/saxes/saxes.js")).SaxesParser;
  const url = "https://earthobservatory.nasa.gov/feeds/image-of-the-day.rss";
  console.log(`Requesting EOPOD feed from ${url}`);
  const rss = await getString(session, url, cancellable);

  try {
    const channel = dom.childByName(
      dom.parse(SaxesParser)(rss, { removeWhitespaceTextNodes: true }),
      "channel",
    );
    if (!channel) {
      throw new dom.XmlError("'channel' element not found");
    }
    const item = dom.childByName(channel, "item");
    if (!item) {
      throw new dom.XmlError("No 'item' elements found");
    }
    const title = dom.childByName(item, "title");
    if (!title) {
      throw new dom.XmlError("Item had no 'title'");
    }
    const content = dom.childByName(item, "content:encoded");
    if (!content) {
      throw new dom.XmlError("Item had no 'content'");
    }
    const pubDate = dom.childByName(item, "pubDate");
    if (!pubDate) {
      throw new dom.XmlError("Item had no 'pubDate'");
    }
    const img = findImgs(
      dom.parseFragments(SaxesParser)(dom.innerText(content).trim()),
    )[0];
    if (!img?.attributes["src"]) {
      throw new dom.XmlError("No 'img' found in content");
    }
    const imageUrl = img.attributes["src"];
    const description = dom.childByName(item, "description");
    const link = dom.childByName(item, "link");
    const creator = dom.childByName(item, "dc:creator");
    const date = new Date(dom.innerText(pubDate).trim())
      .toISOString()
      .split("T")[0];
    const image: DownloadableImage = {
      metadata: {
        title: dom.innerText(title).trim(),
        description: description ? dom.innerText(description).trim() : null,
        url: link ? dom.innerText(link).trim() : null,
        copyright: creator ? dom.innerText(creator).trim() : null,
      },
      imageUrl,
      // We _know_ that an ISO formatted date time always has the date before a T,
      // so we ! our way out of the undefined here.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      pubdate: date!,
    };
    return [image];
  } catch (cause) {
    throw new HttpRequestError(url, `Failed to parse RSS from ${url}`, {
      cause,
    });
  }
};

/**
 * A source for images from EOPOD.
 */
export const source: Source = {
  metadata,
  getImages: {
    type: "simple",
    getImages,
  },
};

export default source;
