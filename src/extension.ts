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

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Soup from "gi://Soup";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { GetImages, Source } from "./lib/source.js";
import { PictureOfTheDayIndicator } from "./lib/ui/indicator.js";
import { DownloadImage, RefreshService } from "./lib/services/refresh.js";
import { ExtensionIcons } from "./lib/ui/icons.js";
import { DesktopBackgroundService } from "./lib/services/desktop-background.js";
import { ImageMetadataStore } from "./lib/services/image-metadata-store.js";
import { RefreshErrorHandler } from "./lib/services/refresh-error-handler.js";
import { launchSettingsPanel } from "./lib/ui/settings.js";
import { SourceSelector } from "./lib/services/source-selector.js";
import { RefreshScheduler } from "./lib/services/refresh-scheduler.js";
import {
  Destroyer,
  Destructible,
  SignalConnectionTracker,
} from "./lib/util/lifecycle.js";
import { TimerRegistry } from "./lib/services/timer-registry.js";
import { createSession } from "./lib/network/http.js";
import { downloadImage } from "./lib/util/download.js";
import random from "./lib/util/random.js";
import { NoPictureTodayError } from "./lib/source/errors.js";

// Promisify all the async APIs we use
Gio._promisify(Gio.OutputStream.prototype, "splice_async");
Gio._promisify(Gio.File.prototype, "create_async");
Gio._promisify(Gio.File.prototype, "delete_async");
Gio._promisify(Soup.Session.prototype, "send_and_read_async");
Gio._promisify(Soup.Session.prototype, "send_async");

/**
 * Track the state of this extension.
 */
class EnabledExtension implements Destructible {
  private readonly settings: Gio.Settings;

  private readonly destroyer: Destroyer = new Destroyer();

  constructor(private readonly extension: Extension) {
    // Our settings
    this.settings = extension.getSettings();

    // Infrastructure for the user interface.
    const iconLoader = new ExtensionIcons(
      extension.metadata.dir.get_child("icons"),
    );
    // Infrastructure for keeping track of things to dispose
    const signalTracker = this.destroyer.add(new SignalConnectionTracker());
    const timers = this.destroyer.add(new TimerRegistry());

    // Set up the UI
    const indicator = this.destroyer.add(
      new PictureOfTheDayIndicator(iconLoader),
    );
    Main.panel.addToStatusArea(extension.metadata.uuid, indicator);

    // Set up notifications by this extension.
    const errorHandler = this.destroyer.add(
      new RefreshErrorHandler(iconLoader),
    );

    // Restore metadata for the current image
    const desktopBackground = DesktopBackgroundService.default();
    const imageMetadataStore = new ImageMetadataStore(this.settings);
    const storedImage = imageMetadataStore.loadFromMetadata();
    if (storedImage !== null) {
      const currentWallpaperUri = desktopBackground.backgroundImage;
      if (storedImage.file.get_uri() === currentWallpaperUri) {
        indicator.showImageMetadata(storedImage);
      }
    }

    // Setup automatic refreshing
    const refreshService = this.destroyer.add(
      new RefreshService(createSession(this.extension.metadata)),
    );
    const refreshScheduler = this.destroyer.add(
      new RefreshScheduler(refreshService, errorHandler, timers),
    );
    // Restore and persist the last schedule refresh.
    const lastRefresh = this.settings.get_string("last-scheduled-refresh");
    if (lastRefresh && 0 < lastRefresh.length) {
      refreshScheduler.lastRefresh = GLib.DateTime.new_from_iso8601(
        lastRefresh,
        null,
      );
    }
    refreshScheduler.connect("refresh-completed", (_, timestamp): undefined => {
      this.settings.set_string(
        "last-scheduled-refresh",
        timestamp.format_iso8601(),
      );
    });
    if (this.settings.get_boolean("refresh-automatically")) {
      refreshScheduler.start();
    }
    signalTracker.track(
      this.settings,
      this.settings.connect("changed::refresh-automatically", () => {
        if (this.settings.get_boolean("refresh-automatically")) {
          refreshScheduler.start();
        } else {
          refreshScheduler.stop();
        }
      }),
    );

    // Trigger an immediate refresh after a user action.

    // Unlike scheduled refreshes we immediately show all errors, and do not handle
    // intermittent network errors in any special way.
    const refreshAfterUserAction = () => {
      refreshService.refresh().catch((error) => {
        errorHandler.showError(error);
      });
    };

    // Wire up the current source
    const currentSource = this.settings.get_string("selected-source");
    if (currentSource === null) {
      throw new Error("Current source 'null'?");
    }
    const sourceSelector = this.destroyer.add(
      SourceSelector.forKey(currentSource),
    );
    signalTracker.track(
      this.settings,
      this.settings.connect("changed::selected-source", () => {
        const key = this.settings.get_string("selected-source");
        if (key) {
          try {
            sourceSelector.selectSource(key);
          } catch (error) {
            console.error("Source could not be loaded", key);
          }
        }
      }),
    );
    indicator.updateSelectedSource(sourceSelector.selectedSource.metadata);
    const updateDownloader = () => {
      const customImageUri = this.settings
        .get_value("image-download-folder")
        .deepUnpack<string | null>();
      const downloadDirectory =
        customImageUri === null
          ? Gio.File.new_for_path(GLib.get_user_state_dir())
              .get_child(this.extension.metadata.uuid)
              .get_child("images")
          : Gio.File.new_for_uri(customImageUri);
      const downloader = this.createDownloader(
        downloadDirectory,
        sourceSelector.selectedSource,
      );
      refreshService.setDownloader(downloader);
    };
    sourceSelector.connect("source-changed", (_selector, source): undefined => {
      updateDownloader();
      indicator.updateSelectedSource(source.metadata);
      // Refresh immediately; the source only ever changes when the user
      // explicitly asked for it to change.
      refreshAfterUserAction();
    });

    // Listen to changes in the download directory
    signalTracker.track(
      this.settings,
      this.settings.connect("changed::image-download-folder", () => {
        updateDownloader();
      }),
    );

    // Initialize the downloader for the current source
    updateDownloader();

    // Now wire up all the signals between the services and the UI.
    // React on user actions on the indicator
    indicator.connect("activated::preferences", () => {
      extension.openPreferences();
    });
    indicator.connect("activated::refresh", () => {
      console.log("Refresh emitted");
      refreshAfterUserAction();
    });
    indicator.connect("activated::cancel-refresh", () => {
      void refreshService.cancelRefresh();
    });
    indicator.connect("switch-source", (_, sourceKey: string) => {
      this.settings.set_string("selected-source", sourceKey);
    });

    // Make everyone react on a new picture of the day
    refreshService.connect("state-changed", (_, state): undefined => {
      indicator.updateRefreshState(state);
    });
    refreshService.connect("refresh-completed", (_, image): undefined => {
      indicator.showImageMetadata(image);
      imageMetadataStore.storedMetadataForImage(image);
      desktopBackground.setBackgroundImageFile(image.file);
    });

    // Handle user reactions on errors
    errorHandler.connect("action::open-preferences", (): undefined => {
      this.extension.openPreferences();
    });
    errorHandler.connect("action::open-network-settings", (): undefined => {
      launchSettingsPanel("network");
    });
  }

  private createGetImage(source: Source): GetImages {
    switch (source.getImages.type) {
      case "simple":
        return source.getImages.getImages;
      case "needs_settings": {
        const settings = this.extension.getSettings(
          `${this.extension.getSettings().schema_id}.source.${
            source.metadata.key
          }`,
        );
        return source.getImages.create(settings);
      }
    }
  }

  /**
   * Create the download function to use.
   *
   * @param downloadBaseDirectory The base download directory
   * @param source The selected source
   * @returns A function to download images from the source
   */
  private createDownloader(
    downloadBaseDirectory: Gio.File,
    source: Source,
  ): DownloadImage {
    const downloadDirectory = downloadBaseDirectory.get_child(
      source.metadata.name,
    );
    const getImage = this.createGetImage(source);

    return async (session: Soup.Session, cancellable: Gio.Cancellable) => {
      const images = await getImage(session, cancellable);
      const image = images.length === 1 ? images[0] : random.sample(images);
      if (typeof image === "undefined") {
        throw new NoPictureTodayError(source.metadata);
      }
      return downloadImage(session, downloadDirectory, cancellable, image);
    };
  }

  destroy() {
    this.destroyer.destroy();
  }
}

/**
 * An extension to use a picture of the day from various sources as wallpaper.
 */
export default class PictureOfTheDayExtension extends Extension {
  private enabledExtension?: Destructible | null;

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
