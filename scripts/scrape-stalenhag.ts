#!/usr/bin/env -S deno --no-config --no-lock run --ext ts --allow-net=simonstalenhag.se

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { DOMParser } from "jsr:@b-fuze/deno-dom";

const BASE_URL = new URL("https://simonstalenhag.se/");

interface Collection {
  readonly tag: string;
  readonly title: string;
}

interface Image {
  readonly src: URL;
}

interface ImageCollection extends Collection {
  readonly images: readonly Image[];
  readonly url: URL;
}

const KNOWN_COLLECTIONS: readonly Collection[] = [
  { title: "SWEDISH MACHINES (2024)", tag: "svema" },
  { title: "THE LABYRINTH (2020)", tag: "labyrinth" },
  { title: "THE ELECTRIC STATE (2017)", tag: "es" },
  { title: "THINGS FROM THE FLOOD (2016)", tag: "tftf" },
  { title: "TALES FROM THE LOOP (2014)", tag: "tftl" },
  { title: "PALEOART", tag: "paleo" },
  { title: "COMMISSIONS, UNPUBLISHED WORK AND SOLO PIECES", tag: "other" },
];

const scrapeCollection = async (
  collection: Collection,
): Promise<ImageCollection> => {
  const url = new URL(`${collection.tag}.html`, BASE_URL);
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "https://github.com/swsnr/gnome-shell-extension-picture-of-the-day",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to scrape collection from ${url}!`);
  }
  const body = new DOMParser().parseFromString(
    await response.text(),
    "text/html",
  );
  const seenUrls = new Set<string>();
  const images: Image[] = [];
  for (const img of body.querySelectorAll("a > img")) {
    const a = img.parentElement;
    if (!a) {
      throw new Error("img has no parent element");
    }
    if (a.tagName !== "A") {
      throw new Error(`img parent not an a tag, but ${a.tagName}`);
    }
    const href = a.getAttribute("href");
    if (!href) {
      throw new Error("a tag missing href element");
    }
    if (href.endsWith(".jpg")) {
      const src = new URL(href, BASE_URL);
      if (!seenUrls.has(src.toString())) {
        seenUrls.add(src.toString());
        images.push({
          src: new URL(href, BASE_URL),
        });
      }
    }
  }
  return {
    ...collection,
    images: Array.from(images),
    url,
  };
};

const main = async (): Promise<void> => {
  const allImageCollections = await Promise.all(
    KNOWN_COLLECTIONS.map(scrapeCollection),
  );
  console.log(JSON.stringify(allImageCollections, undefined, 2));
};

if (import.meta.main) {
  main();
}
