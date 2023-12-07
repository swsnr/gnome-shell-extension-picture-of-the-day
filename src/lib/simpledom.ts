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

// Note: We deliberatly only import types here, because we'll lazy-load saxes
// when required, to avoid making everyone pay the burden of this library even
// if they don't use corresponding sources.
import type { SaxesOptions, SaxesParser } from "./vendor/saxes/saxes.js";

/**
 * A dead stupid DOM, just sufficient to parse some simple XML documents.
 */

/**
 * Either an element or a text node.
 */
// eslint-disable-next-line no-use-before-define
export type Node = Element | string;

interface MutableElement {
  name: string;
  attributes: Record<string, string>;
  children: Node[];
}

/**
 * Attributes, as immutable record of strings.
 */
export type Attributes = Readonly<Record<string, string>>;

/**
 * An XML element.
 */
export interface Element {
  /** The fully qualified element name. */
  readonly name: string;
  /** The attributes of this element */
  readonly attributes: Attributes;
  /**
   * The children of this element.
   */
  readonly children: readonly Node[];
}

/**
 * Whether `n` is an element.
 */
export const isElement = (n: Node | null | undefined): n is Element =>
  n !== null && typeof n !== "undefined" && typeof n !== "string";

/**
 * An error which occurred while processing this XML.
 */
export class XmlError extends Error {}

/**
 * Options for parsing.
 */
export interface ParseOptions {
  /**
   * Remove whitespace-only text and cdata nodes.
   */
  readonly removeWhitespaceTextNodes: boolean;
}

/**
 * Run a parser against an input and return the result.
 *
 * @param parser The parser to run
 * @param s The input string
 * @param options saxes options
 * @returns A list of all fragment nodes parsed out of `s`.
 */
const runParser = (
  parser: SaxesParser,
  s: string,
  options?: ParseOptions,
): readonly Node[] => {
  const toplevels: (string | MutableElement)[] = [];
  const elementStack: MutableElement[] = [];
  parser.on("error", (error) => {
    throw new XmlError(error.message, { cause: error });
  });
  parser.on("opentag", (node) => {
    const element = {
      name: node.name,
      attributes: node.attributes,
      children: [],
    };
    if (elementStack.length === 0) {
      toplevels.push(element);
    } else {
      elementStack[elementStack.length - 1]?.children.push(element);
    }
    elementStack.push(element);
  });
  parser.on("text", (text) => {
    if (!(options?.removeWhitespaceTextNodes && text.trim().length === 0)) {
      elementStack[elementStack.length - 1]?.children.push(text);
    }
  });
  parser.on("cdata", (data) => {
    if (!(options?.removeWhitespaceTextNodes && data.trim().length === 0)) {
      elementStack[elementStack.length - 1]?.children.push(data);
    }
  });
  parser.on("closetag", () => {
    elementStack.pop();
  });

  parser.write(s).close();
  return toplevels;
};

type Parser<O> = new (opts?: O) => SaxesParser;

/**
 * Parse an XML document in `s`.
 *
 * @returns The single root element
 */
export const parse =
  (Parser: Parser<object>) =>
  (s: string, options?: ParseOptions): Element => {
    const roots = runParser(new Parser(), s, options);
    if (roots.length === 1 && isElement(roots[0])) {
      return roots[0];
    } else {
      throw new XmlError("Expected exactly one root element");
    }
  };

/**
 * Parse XML fragments out of `s`.
 *
 * @returns An array with all fragments.
 */
export const parseFragments =
  (Parser: Parser<SaxesOptions>) =>
  (s: string, options?: ParseOptions): readonly Node[] =>
    runParser(new Parser({ fragment: true }), s, options);

/** Get immediate child elements with the given name. */
export const childrenByName = (e: Element, name: string): readonly Element[] =>
  e.children.filter((n): n is Element => isElement(n) && n.name === name);

/** Find the first immediate child with the given name. */
export const childByName = (e: Element, name: string): Element | undefined =>
  e.children.find((n): n is Element => isElement(n) && n.name === name);

/** Get the recursive inner text of the given element. */
export const innerText = (e: Element): string =>
  e.children
    .map((n) => {
      if (isElement(n)) {
        return innerText(n);
      } else {
        return n;
      }
    })
    .join("");
