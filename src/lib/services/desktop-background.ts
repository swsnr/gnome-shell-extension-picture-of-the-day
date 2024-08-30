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

/**
 * Manage the desktop background.
 */
export class DesktopBackgroundService {
  /**
   * Create a new background service.
   *
   * @param settings The settings on which to change the background.
   */
  constructor(private readonly settings: Gio.Settings) {}

  /**
   * Create a service for the default background settings of GNOME.
   */
  static default(): DesktopBackgroundService {
    const settings = Gio.Settings.new("org.gnome.desktop.background");
    return new DesktopBackgroundService(settings);
  }

  /**
   * Get the current background image.
   *
   * Only looks at the key for the default theme.
   */
  get backgroundImage(): string | null {
    return this.settings.get_string("picture-uri");
  }

  /**
   * Set the current background image, for both default and dark themes.
   */
  set backgroundImage(uri: string) {
    console.log("Changing desktop background", uri);
    for (const key of ["picture-uri", "picture-uri-dark"]) {
      this.settings.set_string(key, uri);
    }
  }

  /**
   * Change the background image.
   *
   * @param image The image file to use as new background
   */
  setBackgroundImageFile(image: Gio.File): void {
    this.backgroundImage = image.get_uri();
  }
}
