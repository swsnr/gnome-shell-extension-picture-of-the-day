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

import {
  Extension,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import { PopupMenuSection } from "resource:///org/gnome/shell/ui/popupMenu.js";

/**
 * The indicator of this extension.
 */
const PictureOfTheDayIndicator = GObject.registerClass(
  class PictureOfTheDayIndicator extends PanelMenu.Button {
    constructor(extension: Extension) {
      super(0, "PictureOfTheDayIndicator", false);

      // TODO: Load and initialize icon
      const gicon = Gio.FileIcon.new(
        extension.metadata.dir.get_child("icon.svg"),
      );
      this.add_child(new St.Icon({ style_class: "system-status-icon", gicon }));

      const generalItems = new PopupMenuSection();
      generalItems.addAction(_("Settings"), () => {
        extension.openPreferences();
      });

      for (const section of [generalItems]) {
        this.menu.addMenuItem(section);
      }
    }
  },
);

type PictureOfTheDayIndicator = InstanceType<typeof PictureOfTheDayIndicator>;

/**
 * Track
 */
class EnabledExtension {
  private indicator: PictureOfTheDayIndicator;

  constructor(extension: Extension) {
    this.indicator = new PictureOfTheDayIndicator(extension);
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
