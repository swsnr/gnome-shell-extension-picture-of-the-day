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
import Shell from "gi://Shell";

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

import { DownloadScheduler } from "../network/download.js";
import { DownloadDirectories, Image } from "../source.js";
import APOD from "../sources/apod.js";

class ImageInfoSection extends PopupMenuSection {
  private readonly title: PopupMenuItem;
  private readonly description: PopupMenuItem;
  private readonly copyright: PopupMenuItem;

  private urlToOpen: string | null = null;

  private get allItems(): readonly PopupMenuItem[] {
    return [this.title, this.description, this.copyright];
  }

  constructor() {
    super();

    this.title = new PopupMenuItem("");
    // Make the title stand out
    this.title.style = "font-weight: 700; font-size: 12pt;";
    this.title.connect("activate", () => {
      if (this.urlToOpen !== null) {
        Gio.app_info_launch_default_for_uri(
          this.urlToOpen,
          Shell.Global.get().create_app_launch_context(0, -1),
        );
      }
    });

    // The description is a long text, so limit the width of the menu item, and
    // enable text wrapping.
    this.description = new PopupMenuItem("");
    this.description.style = "max-width: 400px";
    this.description.label.clutter_text.line_wrap = true;

    this.copyright = new PopupMenuItem("");

    for (const item of this.allItems) {
      item.set_reactive(false);
      // Don't dim text, but let's still not click on these elements
      item.remove_style_pseudo_class("insensitive");
      this.addMenuItem(item);
    }

    this.unsetImage();
  }

  unsetImage(): void {
    this.urlToOpen = null;
    for (const item of this.allItems) {
      item.label.text = "";
      item.visible = false;
    }
  }

  setImage(image: Image): void {
    this.urlToOpen = image.url;
    for (const item of this.allItems) {
      item.visible = true;
    }

    this.title.label.set_text(image.title.trim());
    if (this.urlToOpen) {
      this.title.reactive = true;
    } else {
      this.title.reactive = false;
      this.title.remove_style_pseudo_class("insensitive");
    }

    if (image.description) {
      this.description.label.text = image.description.trim();
      this.description.label.visible = true;
    } else {
      this.description.label.text = "";
      this.description.visible = false;
    }

    if (image.copyright) {
      this.copyright.label.text = _(`Copyright ${image.copyright.trim()}`);
      this.copyright.visible = true;
    } else {
      this.copyright.label.text = "";
      this.copyright.visible = false;
    }
  }
}

/**
 * The main indicator of this extension.
 */
export const PictureOfTheDayIndicator = GObject.registerClass(
  class PictureOfTheDayIndicator extends PanelMenu.Button {
    private readonly imageInfoSection: ImageInfoSection;

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

      this.imageInfoSection = new ImageInfoSection();

      const refreshItems = new PopupMenuSection();
      this.refresh = new PopupMenuItem("");
      refreshItems.addMenuItem(this.refresh);
      this.resetRefreshLabel();
      this.refresh.connect("activate", () => {
        if (scheduler.downloadOngoing) {
          void scheduler.cancelCurrentDownload().finally(() => {
            this.resetRefreshLabel();
          });
        } else {
          this.refresh.label.set_text(_("Cancel refresh…"));
          scheduler
            .download(download)
            .then((image) => {
              this.resetRefreshLabel();
              if (image.result === "completed") {
                console.log("Downloaded image", image);
                this.imageInfoSection.setImage(image.value);
              }
              return;
            })
            .catch((error) => {
              // TODO: Show proper error message
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
        this.imageInfoSection,
        new PopupSeparatorMenuItem(),
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
