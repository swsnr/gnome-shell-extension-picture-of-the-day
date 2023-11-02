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
import St from "gi://St";

export interface IconLoader {
  loadIcon(name: string): Gio.Icon;
}

export class ExtensionIcons implements IconLoader {
  private theme: St.IconTheme = St.IconTheme.new();

  constructor(iconDirectory: Gio.File) {
    const iconPath = iconDirectory.get_path();
    if (iconPath === null) {
      throw new Error("Failed to get path of icon directory");
    }
    this.theme.append_search_path(iconPath);
  }

  loadIcon(name: string): Gio.Icon {
    // We only include SVG icons currently, so we can just specify any size and
    // ignore the scale.  We force SVG to be on the safe side.
    const icon = this.theme.lookup_icon(name, 16, St.IconLookupFlags.FORCE_SVG);
    if (icon === null) {
      throw new Error(`Icon ${name} not found`);
    }
    const iconFilename = icon.get_filename();
    if (iconFilename === null) {
      throw new Error(`Icon ${name} had no file`);
    }
    return Gio.FileIcon.new(Gio.File.new_for_path(iconFilename));
  }
}
