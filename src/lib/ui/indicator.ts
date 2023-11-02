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
import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

import { Image } from "../source.js";
import { IconLoader } from "./icons.js";
import { RefreshState } from "../services/refresh.js";

// eslint-disable-next-line no-restricted-properties
const vprintf = imports.format.vprintf;

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
        // TODO: Perhaps we should externalize this into a signal?
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
      this.copyright.label.text = vprintf(_("Copyright %s"), [
        image.copyright.trim(),
      ]);
      this.copyright.visible = true;
    } else {
      this.copyright.label.text = "";
      this.copyright.visible = false;
    }
  }
}

class ImageOpenSection extends PopupMenuSection {
  private imageFileToOpen: Gio.File | null = null;

  constructor() {
    super();

    this.addAction(_("Open image"), () => {
      const imageUri = this.imageFileToOpen?.get_uri();
      if (imageUri) {
        Gio.app_info_launch_default_for_uri(
          imageUri,
          Shell.Global.get().create_app_launch_context(0, -1),
        );
      }
    });
    this.addAction(_("Open image folder"), () => {
      const folderUri = this.imageFileToOpen?.get_parent()?.get_uri();
      if (folderUri) {
        Gio.app_info_launch_default_for_uri(
          folderUri,
          Shell.Global.get().create_app_launch_context(0, -1),
        );
      }
    });
  }

  setImage(image: Image) {
    this.imageFileToOpen = image.file;
  }
}

/**
 * The main indicator of this extension.
 */
export const PictureOfTheDayIndicator = GObject.registerClass(
  {
    Signals: {
      activated: {
        flags: [GObject.SignalFlags.DETAILED],
      },
    },
  },
  class PictureOfTheDayIndicator extends PanelMenu.Button {
    private readonly imageInfoSection: ImageInfoSection;
    private readonly imageOpenSection: ImageOpenSection;
    private readonly refresh: PopupMenuItem;

    private refreshAction: "refresh" | "cancel-refresh" = "refresh";

    constructor(iconLoader: IconLoader) {
      super(0, "PictureOfTheDayIndicator", false);
      this.add_child(
        new St.Icon({
          style_class: "system-status-icon",
          gicon: iconLoader.loadIcon("picture-of-the-day-symbolic"),
        }),
      );

      this.imageInfoSection = new ImageInfoSection();
      this.imageOpenSection = new ImageOpenSection();

      const refreshItems = new PopupMenuSection();
      this.refresh = new PopupMenuItem("");
      refreshItems.addMenuItem(this.refresh);
      // Initially assume we're in completed state to allow the user to refresh
      // manually
      this.updateRefreshState("completed");
      this.refresh.connect("activate", () => {
        switch (this.refreshAction) {
          case "refresh":
            this.emit("activated::refresh");
            break;
          case "cancel-refresh":
            this.emit("activated::cancel-refresh");
            break;
        }
      });

      const generalItems = new PopupMenuSection();
      generalItems.addAction(_("Settings"), () => {
        this.emit("activated::settings");
      });

      for (const section of [
        this.imageInfoSection,
        new PopupSeparatorMenuItem(),
        refreshItems,
        new PopupSeparatorMenuItem(),
        this.imageOpenSection,
        new PopupSeparatorMenuItem(),
        generalItems,
      ]) {
        this.menu.addMenuItem(section);
      }
    }

    updateRefreshState(state: RefreshState): void {
      if (state === "ongoing") {
        this.refresh.label.set_text(_("Cancel refresh…"));
        this.refreshAction = "cancel-refresh";
      } else {
        this.refresh.label.set_text(_("Refresh"));
        this.refreshAction = "refresh";
      }
    }

    showImageMetadata(image: Image): void {
      this.imageInfoSection.setImage(image);
      this.imageOpenSection.setImage(image);
    }
  },
);

export type PictureOfTheDayIndicator = InstanceType<
  typeof PictureOfTheDayIndicator
>;
