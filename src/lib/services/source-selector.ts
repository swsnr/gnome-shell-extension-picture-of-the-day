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

import { EventEmitter } from "resource:///org/gnome/shell/misc/signals.js";

import { Source } from "../source.js";
import sources from "../sources.js";

export class NoSuchSource extends Error {
  constructor(
    readonly key: string,
    opts?: ErrorOptions,
  ) {
    super(`No source with ${key} exists`, opts);
  }
}

const findSourceByKey = (key: string): Source => {
  const source = sources.find((s) => s.metadata.key === key);
  if (source) {
    return source;
  } else {
    throw new NoSuchSource(key);
  }
};

interface SourceSelectorSignals {
  readonly "source-changed": [Source];
}

export class SourceSelector extends EventEmitter<SourceSelectorSignals> {
  private _selectedSource: Source;

  constructor(source: Source) {
    super();
    this._selectedSource = source;
  }

  static forKey(key: string): SourceSelector {
    return new SourceSelector(findSourceByKey(key));
  }

  selectSource(key: string): void {
    this._selectedSource = findSourceByKey(key);
    this.emit("source-changed", this._selectedSource);
  }

  get selectedSource(): Source {
    return this._selectedSource;
  }
}
