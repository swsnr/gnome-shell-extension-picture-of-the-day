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
import Gio from "gi://Gio";
import St from "gi://St";

import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import {
  PopupMenuItem,
  PopupMenuSection,
  PopupSeparatorMenuItem,
} from "resource:///org/gnome/shell/ui/popupMenu.js";
import {
  gettext as _,
  Extension,
} from "resource:///org/gnome/shell/extensions/extension.js";

import { DownloadScheduler } from "./download.js";
import { DownloadDirectories } from "./source.js";
import APOD from "./sources/apod.js";

/**
 * The main indicator of this extension.
 */
export const PictureOfTheDayIndicator = GObject.registerClass(
  class PictureOfTheDayIndicator extends PanelMenu.Button {
    private readonly refresh: PopupMenuItem;

    constructor(
      extension: Extension,
      scheduler: DownloadScheduler,
      baseDirectories: DownloadDirectories,
    ) {
      super(0, "PictureOfTheDayIndicator", false);

      const source = APOD;

      const sourceSettings = extension.getSettings(
        `${extension.getSettings().schema_id}.source.${source.metadata.key}`,
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

      const download = APOD.createDownloader(sourceSettings, directories);

      const gicon = Gio.FileIcon.new(
        extension.metadata.dir
          .get_child("icon")
          .get_child("picture-of-the-day-symbolic.svg"),
      );
      this.add_child(new St.Icon({ style_class: "system-status-icon", gicon }));

      const refreshItems = new PopupMenuSection();
      this.refresh = new PopupMenuItem("");
      refreshItems.addMenuItem(this.refresh);
      this.resetRefreshLabel();
      this.refresh.connect("activate", () => {
        if (scheduler.downloadOngoing) {
          scheduler.cancelCurrentDownload();
          this.resetRefreshLabel();
        } else {
          this.refresh.label.set_text(_("Cancel refresh…"));
          scheduler
            .download(download)
            .then((image) => {
              console.log("Downloaded image", image);
              this.resetRefreshLabel();
              return;
            })
            .catch((error) => {
              // Show proper error message
              console.error("Failed to download image", error);
              this.resetRefreshLabel();
            });
        }
      });

      const generalItems = new PopupMenuSection();
      generalItems.addAction(_("Settings"), () => {
        extension.openPreferences();
      });

      for (const section of [
        refreshItems,
        new PopupSeparatorMenuItem(),
        generalItems,
      ]) {
        this.menu.addMenuItem(section);
      }
    }

    private resetRefreshLabel(): void {
      this.refresh.label.set_text(_("Refresh"));
    }
  },
);

export type PictureOfTheDayIndicator = InstanceType<
  typeof PictureOfTheDayIndicator
>;
