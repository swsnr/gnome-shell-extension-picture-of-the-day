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

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { DownloadDirectories, DownloadImage } from "./lib/source.js";
import { PictureOfTheDayIndicator } from "./lib/ui/indicator.js";
import { RefreshService } from "./lib/services/refresh.js";
import APOD from "./lib/sources/apod.js";
import { ExtensionIcons } from "./lib/ui/icons.js";
import { DesktopBackgroundService } from "./lib/services/desktop-background.js";

// Promisify all the async APIs we use
Gio._promisify(Gio.OutputStream.prototype, "splice_async");
Gio._promisify(Gio.File.prototype, "create_async");
Gio._promisify(Soup.Session.prototype, "send_and_read_async");
Gio._promisify(Soup.Session.prototype, "send_async");

/**
 * Track the state of this extension.
 */
class EnabledExtension {
  private readonly indicator: PictureOfTheDayIndicator;
  private readonly refreshService: RefreshService = new RefreshService();
  private readonly desktopBackgroundService: DesktopBackgroundService =
    DesktopBackgroundService.default();

  constructor(private readonly extension: Extension) {
    const iconLoader = new ExtensionIcons(
      extension.metadata.dir.get_child("icon"),
    );
    const baseDirectories = this.getBaseDirectories();
    this.refreshService.setDownloader(this.createDownloader(baseDirectories));

    this.indicator = new PictureOfTheDayIndicator(iconLoader);
    Main.panel.addToStatusArea(extension.metadata.uuid, this.indicator);

    // React on user actions on the indicator
    this.indicator.connect("activated::settings", () => {
      extension.openPreferences();
    });
    this.indicator.connect("activated::refresh", () => {
      this.refreshService.startRefresh();
    });
    this.indicator.connect("activated::cancel-refresh", () => {
      this.refreshService.cancelRefresh();
    });

    // Make everyone react on a new picture of the day
    this.refreshService.connect("image-changed", (_, image): undefined => {
      this.indicator.showImageMetadata(image);
      this.desktopBackgroundService.setBackgroundImage(image.file);
    });
  }

  /**
   * Get the base directories this extension should use for storage.
   *
   * @returns The base directories for this extension.
   */
  private getBaseDirectories(): DownloadDirectories {
    const picturesDirectory = GLib.get_user_special_dir(
      GLib.UserDirectory.DIRECTORY_PICTURES,
    );
    const imageDirectory = picturesDirectory
      ? Gio.File.new_for_path(picturesDirectory).get_child(
          this.extension.metadata.name,
        )
      : // If the user has no directory for pictures, put files into the state directory.
        Gio.File.new_for_path(GLib.get_user_state_dir())
          .get_child(this.extension.metadata.uuid)
          .get_child("images");
    return {
      stateDirectory: Gio.File.new_for_path(
        GLib.get_user_state_dir(),
      ).get_child(this.extension.metadata.uuid),
      cacheDirectory: Gio.File.new_for_path(
        GLib.get_user_cache_dir(),
      ).get_child(this.extension.metadata.uuid),
      imageDirectory,
    };
  }

  /**
   * Create the download function to use.
   *
   * @param baseDirectories The base directories from which to derive the directories the source can use to store data
   * @returns A function to download images from the source
   */
  private createDownloader(
    baseDirectories: DownloadDirectories,
  ): DownloadImage {
    // TODO: Move this into a separate service which manages the current source
    const source = APOD;

    const sourceSettings = this.extension.getSettings(
      `${this.extension.getSettings().schema_id}.source.${source.metadata.key}`,
    );
    const directories: DownloadDirectories = {
      stateDirectory: baseDirectories.stateDirectory.get_child(
        source.metadata.key,
      ),
      cacheDirectory: baseDirectories.cacheDirectory.get_child(
        source.metadata.key,
      ),
      // For the user visible image directory we use a human-readable name.
      imageDirectory: baseDirectories.imageDirectory.get_child(
        source.metadata.name,
      ),
    };

    return APOD.createDownloader(sourceSettings, directories);
  }

  destroy() {
    // Disconnect all signals on our services, to free all references to the
    // signal handlers and prevent reference cycles keeping objects alive beyond
    // destruction of this extension.
    for (const obj of [this.refreshService]) {
      obj.disconnectAll();
    }
    // This should automatically disconnect all signals on the indicator and
    // thus free all references to signal handlers
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
