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
import { IconThemeLoader } from "./lib/common/ui/icons.js";
import { DesktopBackgroundService } from "./lib/services/desktop-background.js";
import { ImageMetadataStore } from "./lib/services/image-metadata-store.js";
import { RefreshErrorHandler } from "./lib/services/refresh-error-handler.js";
import { launchSettingsPanel } from "./lib/ui/settings.js";
import { SourceSelector } from "./lib/services/source-selector.js";
import { RefreshScheduler } from "./lib/services/refresh-scheduler.js";
import { Destroyer, SignalConnectionTracker } from "./lib/common/lifecycle.js";
import { TimerRegistry } from "./lib/services/timer-registry.js";
import { HttpStatusError, createSession } from "./lib/network/http.js";
import { downloadImage } from "./lib/download.js";
import random from "./lib/common/random.js";
import { NoPictureTodayError } from "./lib/source/errors.js";
import { SourceSettings } from "./lib/source/settings.js";
import { DestructibleExtension } from "./lib/common/extension.js";

// Promisify all the async APIs we use
Gio._promisify(Gio.OutputStream.prototype, "splice_async");
Gio._promisify(Gio.File.prototype, "create_async");
Gio._promisify(Gio.File.prototype, "delete_async");
Gio._promisify(Soup.Session.prototype, "send_and_read_async");
Gio._promisify(Soup.Session.prototype, "send_async");

const createGetImages = (
  settings: SourceSettings,
  source: Source,
): GetImages => {
  switch (source.getImages.type) {
    case "simple":
      return source.getImages.getImages;
    case "needs_settings": {
      return source.getImages.create(settings.forSource(source.metadata));
    }
  }
};

/**
 * Create the download function to use.
 *
 * @param settings Settings for sources
 * @param downloadBaseDirectory The base download directory
 * @param source The selected source
 * @returns A function to download images from the source
 */
const createDownloader = (
  settings: SourceSettings,
  downloadBaseDirectory: Gio.File,
  source: Source,
): DownloadImage => {
  const downloadDirectory = downloadBaseDirectory.get_child(
    source.metadata.name,
  );
  const getImages = createGetImages(settings, source);

  return async (session: Soup.Session, cancellable: Gio.Cancellable) => {
    const images = await getImages(session, cancellable);
    const image = images.length === 1 ? images[0] : random.sample(images);
    if (typeof image === "undefined") {
      throw new NoPictureTodayError(source.metadata);
    }
    try {
      return downloadImage(session, downloadDirectory, cancellable, image);
    } catch (error) {
      if (
        error instanceof HttpStatusError &&
        error.status === Soup.Status.NOT_FOUND
      ) {
        // We have metadata for the image but the image itself doesn't exist,
        // so assume we do not have a picture for today.
        throw new NoPictureTodayError(source.metadata, { cause: error });
      } else {
        throw error;
      }
    }
  };
};

/**
 * Initialize the extension.
 *
 * Setup UI and all background services and wire things up.
 *
 * Register all destructible objects on the given `destroyer`, for cleanup when
 * the extension is disabled.
 *
 * @param extension The extension to initialize
 * @param destroyer A destroyer to register destructible values on for cleanup
 */
const initializeExtension = (
  extension: Extension,
  destroyer: Destroyer,
): void => {
  // Our settings
  const settings = extension.getSettings();

  // Infrastructure for the user interface.
  const iconLoader = new IconThemeLoader(
    extension.metadata.dir.get_child("icons"),
  );
  // Infrastructure for keeping track of things to dispose
  const signalTracker = destroyer.add(new SignalConnectionTracker());
  const timers = destroyer.add(new TimerRegistry());

  // Set up the UI
  const indicator = destroyer.add(new PictureOfTheDayIndicator(iconLoader));
  Main.panel.addToStatusArea(extension.metadata.uuid, indicator);

  // Set up error notifications by this extension.
  const errorHandler = destroyer.add(new RefreshErrorHandler(iconLoader));

  // Restore metadata for the current image
  const desktopBackground = DesktopBackgroundService.default();
  const imageMetadataStore = new ImageMetadataStore(settings);
  const storedImage = imageMetadataStore.loadFromMetadata();
  if (storedImage !== null) {
    const currentWallpaperUri = desktopBackground.backgroundImage;
    if (storedImage.file.get_uri() === currentWallpaperUri) {
      indicator.showImageMetadata(storedImage);
    }
  }

  // Create the refresh service
  const refreshService = destroyer.add(
    new RefreshService(createSession(extension.metadata)),
  );

  // Wire up the current source
  const currentSource = settings.get_string("selected-source");
  if (currentSource === null) {
    throw new Error("Current source 'null'?");
  }
  const sourceSelector = destroyer.add(SourceSelector.forKey(currentSource));
  indicator.updateSelectedSource(sourceSelector.selectedSource.metadata);
  const sourceSettings = SourceSettings.fromBaseSettings(extension, settings);
  const updateDownloader = () => {
    const customImageUri = settings
      .get_value("image-download-folder")
      .deepUnpack<string | null>();
    const downloadDirectory =
      customImageUri === null
        ? Gio.File.new_for_path(GLib.get_user_state_dir())
            .get_child(extension.metadata.uuid)
            .get_child("images")
        : Gio.File.new_for_uri(customImageUri);
    const downloader = createDownloader(
      sourceSettings,
      downloadDirectory,
      sourceSelector.selectedSource,
    );
    refreshService.setDownloader(downloader);
  };
  // Immediately initialize the downloader for the current source
  updateDownloader();

  // Trigger an immediate refresh after a user action.
  // Unlike scheduled refreshes we immediately show all errors, and do not handle
  // intermittent network errors in any special way.
  const refreshAfterUserAction = () => {
    refreshService.refresh().catch((error) => {
      errorHandler.showError(error);
    });
  };

  // Listen for changes to the current source
  signalTracker.track(
    settings,
    settings.connect("changed::selected-source", () => {
      const key = settings.get_string("selected-source");
      if (key) {
        try {
          sourceSelector.selectSource(key);
        } catch (error) {
          console.error("Source could not be loaded", key);
        }
      }
    }),
  );
  sourceSelector.connect("source-changed", (_selector, source): undefined => {
    updateDownloader();
    indicator.updateSelectedSource(source.metadata);
    // Refresh immediately; the source only ever changes when the user
    // explicitly asked for it to change.
    refreshAfterUserAction();
  });

  // Listen to changes in the download directory
  signalTracker.track(
    settings,
    settings.connect("changed::image-download-folder", () => {
      updateDownloader();
    }),
  );

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
    settings.set_string("selected-source", sourceKey);
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
    extension.openPreferences();
  });
  errorHandler.connect("action::open-network-settings", (): undefined => {
    launchSettingsPanel("network");
  });

  // At last, setup automatic refreshing.  This needs to come last because the
  // refresh scheduler might trigger an immediate refresh, so we need to be set
  // at this point.
  const refreshScheduler = destroyer.add(
    new RefreshScheduler(refreshService, errorHandler, timers),
  );
  // Restore and persist the last schedule refresh.
  const lastRefresh = settings.get_string("last-scheduled-refresh");
  if (lastRefresh && 0 < lastRefresh.length) {
    refreshScheduler.lastRefresh = GLib.DateTime.new_from_iso8601(
      lastRefresh,
      null,
    );
  }
  refreshScheduler.connect("refresh-completed", (_, timestamp): undefined => {
    const formatted = timestamp.format_iso8601();
    if (formatted === null) {
      // I don't think this can ever fail; presumably the derived types are just
      // inaccurate here, but let's guard against this nonetheless.
      throw new Error("Failed to convert timestamp to ISO 8601");
    }
    settings.set_string("last-scheduled-refresh", formatted);
  });
  if (settings.get_boolean("refresh-automatically")) {
    refreshScheduler.start();
  }
  signalTracker.track(
    settings,
    settings.connect("changed::refresh-automatically", () => {
      if (settings.get_boolean("refresh-automatically")) {
        refreshScheduler.start();
      } else {
        refreshScheduler.stop();
      }
    }),
  );
};

/**
 * An extension to use a picture of the day from various sources as wallpaper.
 */
export default class PictureOfTheDayExtension extends DestructibleExtension {
  override initialize(destroyer: Destroyer): void {
    initializeExtension(this, destroyer);
  }
}
