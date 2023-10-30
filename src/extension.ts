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
import GLib from "gi://GLib";

import {
  Extension,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { DownloadScheduler } from "./lib/download.js";
import { DownloadDirectories } from "./lib/source";
import { PictureOfTheDayIndicator } from "./lib/indicator.js";

// Promisify all the async APIs we use
Gio._promisify(Gio.OutputStream.prototype, "splice_async");
Gio._promisify(Gio.File.prototype, "create_async");
Gio._promisify(Soup.Session.prototype, "send_and_read_async");
Gio._promisify(Soup.Session.prototype, "send_async");

/**
 * Track the state of this extension.
 */
class EnabledExtension {
  private indicator: PictureOfTheDayIndicator;

  constructor(extension: Extension) {
    const scheduler = new DownloadScheduler();
    const picturesDirectory = GLib.get_user_special_dir(
      GLib.UserDirectory.DIRECTORY_PICTURES,
    );
    const imageDirectory = picturesDirectory
      ? Gio.File.new_for_path(picturesDirectory).get_child(
          extension.metadata.name,
        )
      : // If the user has no directory for pictures, put files into the state directory.
        Gio.File.new_for_path(GLib.get_user_state_dir())
          .get_child(extension.metadata.uuid)
          .get_child("images");
    const baseDirectories: DownloadDirectories = {
      stateDirectory: Gio.File.new_for_path(
        GLib.get_user_state_dir(),
      ).get_child(extension.metadata.uuid),
      cacheDirectory: Gio.File.new_for_path(
        GLib.get_user_cache_dir(),
      ).get_child(extension.metadata.uuid),
      imageDirectory,
    };
    this.indicator = new PictureOfTheDayIndicator(
      extension,
      scheduler,
      baseDirectories,
    );
    Main.panel.addToStatusArea(extension.metadata.uuid, this.indicator);
  }

  destroy() {
    this.indicator.destroy();
  }
}

/**
 * An extension to use a picture of the day from various sources as wallpaper.
 */
export default class PictureOfTheDayExtension extends Extension {
  private enabledExtension?: EnabledExtension | null;

  override enable(): void {
    if (!this.enabledExtension) {
      this.enabledExtension = new EnabledExtension(this);
    }
  }

  override disable(): void {
    this.enabledExtension?.destroy();
    this.enabledExtension = null;
  }
}
