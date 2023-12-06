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

import { GetImage, Source } from "./lib/source.js";
import { PictureOfTheDayIndicator } from "./lib/ui/indicator.js";
import { DownloadImage, RefreshService } from "./lib/services/refresh.js";
import { ExtensionIcons } from "./lib/ui/icons.js";
import { DesktopBackgroundService } from "./lib/services/desktop-background.js";
import { ImageMetadataStore } from "./lib/services/image-metadata-store.js";
import { RefreshErrorHandler } from "./lib/services/refresh-error-handler.js";
import { launchSettingsPanel } from "./lib/ui/settings.js";
import { SourceSelector } from "./lib/services/source-selector.js";
import { RefreshScheduler } from "./lib/services/refresh-scheduler.js";
import { Destructible, SignalConnectionTracker } from "./lib/util/lifecycle.js";
import { TimerRegistry } from "./lib/services/timer-registry.js";
import { createSession } from "./lib/network/http.js";
import { downloadImage } from "./lib/util/download.js";

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
  private readonly indicator: PictureOfTheDayIndicator;

  private readonly settings: Gio.Settings;

  private readonly refreshService: RefreshService;
  private readonly desktopBackgroundService: DesktopBackgroundService =
    DesktopBackgroundService.default();
  private readonly imageMetadataStore: ImageMetadataStore;
  private readonly errorHandler: RefreshErrorHandler;
  private readonly sourceSelector: SourceSelector;
  private readonly refreshScheduler: RefreshScheduler;
  private readonly timerRegistry: TimerRegistry = new TimerRegistry();

  private readonly trackedSignalConnections: SignalConnectionTracker =
    new SignalConnectionTracker();

  constructor(private readonly extension: Extension) {
    // Our settings
    this.settings = extension.getSettings();

    // Some infrastructure
    const iconLoader = new ExtensionIcons(
      extension.metadata.dir.get_child("icons"),
    );

    // Create all service and UI objects
    this.indicator = new PictureOfTheDayIndicator(iconLoader);
    this.errorHandler = new RefreshErrorHandler(iconLoader);
    this.imageMetadataStore = new ImageMetadataStore(this.settings);
    const currentSource = this.settings.get_string("selected-source");
    if (currentSource === null) {
      throw new Error("Current source 'null'?");
    }
    this.sourceSelector = SourceSelector.forKey(currentSource);
    this.refreshService = new RefreshService(
      createSession(this.extension.metadata),
    );
    this.refreshScheduler = new RefreshScheduler(
      this.refreshService,
      this.errorHandler,
      this.timerRegistry,
    );

    // Set up the UI
    Main.panel.addToStatusArea(extension.metadata.uuid, this.indicator);

    // Restore metadata for the current image
    const storedImage = this.imageMetadataStore.loadFromMetadata();
    if (storedImage !== null) {
      const currentWallpaperUri = this.desktopBackgroundService.backgroundImage;
      if (storedImage.file.get_uri() === currentWallpaperUri) {
        this.indicator.showImageMetadata(storedImage);
      }
    }

    // Wire up the current source
    this.trackedSignalConnections.track(
      this.settings,
      this.settings.connect("changed::selected-source", () => {
        const key = this.settings.get_string("selected-source");
        if (key) {
          try {
            this.sourceSelector.selectSource(key);
          } catch (error) {
            console.error("Source could not be loaded", key);
          }
        }
      }),
    );
    this.indicator.updateSelectedSource(
      this.sourceSelector.selectedSource.metadata,
    );
    this.sourceSelector.connect(
      "source-changed",
      (_selector, source): undefined => {
        this.updateDownloader();
        this.indicator.updateSelectedSource(source.metadata);
        // Refresh immediately; the source only ever changes when the user
        // explicitly asked for it to change.
        this.refreshAfterUserAction();
      },
    );

    // Listen to changes in the download directory
    this.trackedSignalConnections.track(
      this.settings,
      this.settings.connect("changed::image-download-folder", () => {
        this.updateDownloader();
      }),
    );

    // Initialize the downloader for the current source
    this.updateDownloader();

    // Setup automatic refreshing
    const lastRefresh = this.settings.get_string("last-scheduled-refresh");
    if (lastRefresh && 0 < lastRefresh.length) {
      this.refreshScheduler.lastRefresh = GLib.DateTime.new_from_iso8601(
        lastRefresh,
        null,
      );
    }
    this.refreshScheduler.connect(
      "refresh-completed",
      (_, timestamp): undefined => {
        this.settings.set_string(
          "last-scheduled-refresh",
          timestamp.format_iso8601(),
        );
      },
    );
    if (this.settings.get_boolean("refresh-automatically")) {
      this.refreshScheduler.start();
    }
    this.trackedSignalConnections.track(
      this.settings,
      this.settings.connect("changed::refresh-automatically", () => {
        if (this.settings.get_boolean("refresh-automatically")) {
          this.refreshScheduler.start();
        } else {
          this.refreshScheduler.stop();
        }
      }),
    );

    // Now wire up all the signals between the services and the UI.
    // React on user actions on the indicator
    this.indicator.connect("activated::preferences", () => {
      extension.openPreferences();
    });
    this.indicator.connect("activated::refresh", () => {
      console.log("Refresh emitted");
      this.refreshAfterUserAction();
    });
    this.indicator.connect("activated::cancel-refresh", () => {
      void this.refreshService.cancelRefresh();
    });
    this.indicator.connect("switch-source", (_, sourceKey: string) => {
      this.settings.set_string("selected-source", sourceKey);
    });

    // Make everyone react on a new picture of the day
    this.refreshService.connect("state-changed", (_, state): undefined => {
      this.indicator.updateRefreshState(state);
    });
    this.refreshService.connect("refresh-completed", (_, image): undefined => {
      this.indicator.showImageMetadata(image);
      this.imageMetadataStore.storedMetadataForImage(image);
      this.desktopBackgroundService.setBackgroundImageFile(image.file);
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
   * Trigger an immediate refresh after a user action.
   *
   * Unlike scheduled refreshes we immediately show all errors, and do not handle
   * intermittent network errors in any special way.
   */
  private refreshAfterUserAction(): void {
    this.refreshService.refresh().catch((error) => {
      this.errorHandler.showError(error);
    });
  }

  /**
   * Create the download function to use and update the refresh service.
   */
  private updateDownloader(): void {
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
      this.sourceSelector.selectedSource,
    );
    this.refreshService.setDownloader(downloader);
  }

  private createGetImage(source: Source): GetImage {
    switch (source.getImage.type) {
      case "simple":
        return source.getImage.getImage;
      case "needs_settings": {
        const settings = this.extension.getSettings(
          `${this.extension.getSettings().schema_id}.source.${
            source.metadata.key
          }`,
        );
        return source.getImage.create(settings);
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
  // eslint-disable-next-line consistent-return
  private createDownloader(
    downloadBaseDirectory: Gio.File,
    source: Source,
  ): DownloadImage {
    const downloadDirectory = downloadBaseDirectory.get_child(
      source.metadata.name,
    );
    const getImage = this.createGetImage(source);

    return async (session: Soup.Session, cancellable: Gio.Cancellable) => {
      const image = await getImage(session, cancellable);
      return downloadImage(session, downloadDirectory, cancellable, image);
    };
  }

  destroy() {
    const destructibles: readonly Destructible[] = [
      this.errorHandler,
      this.indicator,
      this.refreshScheduler,
      this.refreshService,
      this.sourceSelector,
      this.timerRegistry,
      this.trackedSignalConnections,
    ];
    for (const obj of destructibles) {
      obj.destroy();
    }
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
