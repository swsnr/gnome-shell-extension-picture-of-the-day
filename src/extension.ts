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

import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Soup from "gi://Soup";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { DownloadDirectories, DownloadImage, Source } from "./lib/source.js";
import { PictureOfTheDayIndicator } from "./lib/ui/indicator.js";
import { RefreshService } from "./lib/services/refresh.js";
import { ExtensionIcons } from "./lib/ui/icons.js";
import { DesktopBackgroundService } from "./lib/services/desktop-background.js";
import { ImageMetadataStore } from "./lib/services/image-metadata-store.js";
import { RefreshErrorHandler } from "./lib/services/refresh-error-handler.js";
import { launchSettingsPanel } from "./lib/ui/settings.js";
import { SourceSelector } from "./lib/services/source-selector.js";

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

  private readonly settings: Gio.Settings;
  private readonly baseDirectories: DownloadDirectories;

  private readonly refreshService: RefreshService = new RefreshService();
  private readonly desktopBackgroundService: DesktopBackgroundService =
    DesktopBackgroundService.default();
  private readonly imageMetadataStore: ImageMetadataStore;
  private readonly errorHandler: RefreshErrorHandler;
  private readonly sourceSelector: SourceSelector;

  private readonly signalsToDisconnect: [GObject.Object, number][] = [];

  constructor(private readonly extension: Extension) {
    // Our settings
    this.settings = extension.getSettings();
    this.baseDirectories = this.getBaseDirectories();

    // Some additional infrastructure.
    const iconLoader = new ExtensionIcons(
      extension.metadata.dir.get_child("icons"),
    );

    // Set up the UI
    this.indicator = new PictureOfTheDayIndicator(iconLoader);
    Main.panel.addToStatusArea(extension.metadata.uuid, this.indicator);

    // Set up notifications by this extension.
    this.errorHandler = new RefreshErrorHandler(iconLoader);

    // Restore metadata for the current image
    this.imageMetadataStore = new ImageMetadataStore(this.settings);
    const storedImage = this.imageMetadataStore.loadFromMetadata();
    if (storedImage !== null) {
      const currentWallpaperUri = this.desktopBackgroundService.backgroundImage;
      if (storedImage.file.get_uri() === currentWallpaperUri) {
        this.indicator.showImageMetadata(storedImage);
      }
    }

    // Wire up the current source
    const signalNo = this.settings.connect("changed::selected-source", () => {
      const key = this.settings.get_string("selected-source");
      if (key) {
        try {
          this.sourceSelector.selectSource(key);
        } catch (error) {
          console.error("Source could not be loaded", key);
        }
      }
    });
    this.signalsToDisconnect.push([this.settings, signalNo]);
    const currentSource = this.settings.get_string("selected-source");
    if (currentSource === null) {
      throw new Error("Current source 'null'?");
    }
    this.sourceSelector = SourceSelector.forKey(currentSource);
    this.updateDownloader();
    this.sourceSelector.connect("source-changed", (): undefined => {
      this.updateDownloader();
    });

    // Now wire up all the signals between the services and the UI.

    // React on user actions on the indicator
    this.indicator.connect("activated::preferences", () => {
      extension.openPreferences();
    });
    this.indicator.connect("activated::refresh", () => {
      console.log("Refresh emitted");
      this.refreshService.startRefresh();
    });
    this.indicator.connect("activated::cancel-refresh", () => {
      this.refreshService.cancelRefresh();
    });

    // Make everyone react on a new picture of the day
    this.refreshService.connect("state-changed", (_, state): undefined => {
      this.indicator.updateRefreshState(state);
    });
    this.refreshService.connect("image-changed", (_, image): undefined => {
      this.indicator.showImageMetadata(image);
      this.imageMetadataStore.storedMetadataForImage(image);
      this.desktopBackgroundService.setBackgroundImageFile(image.file);
    });

    this.refreshService.connect("refresh-failed", (_, error): undefined => {
      this.errorHandler.showError(error);
    });

    // Handle user reactions on errors
    this.errorHandler.connect("action::open-preferences", (): undefined => {
      this.extension.openPreferences();
    });
    this.errorHandler.connect(
      "action::open-network-settings",
      (): undefined => {
        launchSettingsPanel("network");
      },
    );
  }

  /**
   * Get the base directories this extension should use for storage.
   *
   * @returns The base directories for this extension.
   */
  private getBaseDirectories(): DownloadDirectories {
    const stateDirectory = Gio.File.new_for_path(
      GLib.get_user_state_dir(),
    ).get_child(this.extension.metadata.uuid);
    return {
      stateDirectory: stateDirectory.get_child("sources"),
      cacheDirectory: Gio.File.new_for_path(
        GLib.get_user_cache_dir(),
      ).get_child(this.extension.metadata.uuid),
      imageDirectory: stateDirectory.get_child("images"),
    };
  }

  /**
   * Create the download function to use and update the refresh service.
   */
  private updateDownloader(): void {
    const downloader = this.createDownloader(
      this.baseDirectories,
      this.sourceSelector.selectedSource,
    );
    this.refreshService.setDownloader(downloader);
  }

  /**
   * Create the download function to use.
   *
   * @param baseDirectories The base directories from which to derive the directories the source can use to store data
   * @param source The selected source
   * @returns A function to download images from the source
   */
  // eslint-disable-next-line consistent-return
  private createDownloader(
    baseDirectories: DownloadDirectories,
    source: Source,
  ): DownloadImage {
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

    switch (source.downloadFactory.type) {
      case "simple":
        return source.downloadFactory.create(
          this.extension.metadata,
          directories,
        );
      case "needs_settings": {
        const settings = this.extension.getSettings(
          `${this.extension.getSettings().schema_id}.source.${
            source.metadata.key
          }`,
        );
        return source.downloadFactory.create(
          this.extension.metadata,
          settings,
          directories,
        );
      }
    }
  }

  destroy() {
    // Things that we should disconnect signals from.
    const disconnectables = [
      this.refreshService,
      this.errorHandler,
      this.sourceSelector,
    ];
    // Things that we should explicitly destroy.
    const destructibles = [this.indicator];

    // Disconnect all signals on our services, to free all references to the
    // signal handlers and prevent reference cycles keeping objects alive beyond
    // destruction of this extension.
    for (const obj of disconnectables) {
      obj.disconnectAll();
    }
    for (const [obj, handlerId] of this.signalsToDisconnect) {
      obj.disconnect(handlerId);
    }
    for (const obj of destructibles) {
      obj.destroy();
    }
  }
}

/**
 * An extension to use a picture of the day from various sources as wallpaper.
 */
export default class PictureOfTheDayExtension extends Extension {
  private enabledExtension?: EnabledExtension | null;

  override enable(): void {
    if (!this.enabledExtension) {
      console.log(
        `Enabled extension ${this.metadata.uuid} ${this.metadata["version-name"]}`,
      );
      this.enabledExtension = new EnabledExtension(this);
    }
  }

  override disable(): void {
    this.enabledExtension?.destroy();
    this.enabledExtension = null;
  }
}
