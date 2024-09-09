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
import type { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import type { SourceMetadata } from "./metadata.js";

/**
 * Provide setting objects for sources.
 */
export class SourceSettings {
  constructor(
    private readonly extension: Extension,
    private readonly baseSchemaId: string,
  ) {}

  static fromBaseSettings(
    extension: Extension,
    settings: Gio.Settings,
  ): SourceSettings {
    return new SourceSettings(extension, settings.schemaId);
  }

  /**
   * Get a settings object for the given `source`.
   *
   * @param source The source whose settings to get
   * @returns The settings object with settings for the `source`.
   */
  forSource(source: SourceMetadata): Gio.Settings {
    return this.extension.getSettings(
      `${this.baseSchemaId}.source.${source.key}`,
    );
  }
}
