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
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import apod from "./lib/sources/metadata/apod.js";
import stalenhag from "./lib/sources/metadata/stalenhag.js";
import * as StalenhagCollections from "./lib/sources/stalenhag/collections.js";
import AboutPage from "./lib/prefs/about_page.js";
import SourcesPage from "./lib/prefs/sources_page.js";
import { AllSettings } from "./lib/prefs/settings.js";

Gio._promisify(Gio.File.prototype, "load_contents_async");
Gio._promisify(Gtk.FileDialog.prototype, "select_folder");

interface WindowSettingRegistry {
  _settings: AllSettings;
}

export default class PictureOfTheDayPreferences extends ExtensionPreferences {
  override async fillPreferencesWindow(
    window: Adw.PreferencesWindow & WindowSettingRegistry,
  ): Promise<void> {
    // Add our icons directory to the Gtk theme path, so that we're able to use
    // our icons in Adwaita widgets.
    const iconTheme = Gtk.IconTheme.get_for_display(window.get_display());
    const iconsDirectory = this.metadata.dir.get_child("icons").get_path();
    if (iconsDirectory === null) {
      throw new Error("Failed to get path for icon directory");
    }
    iconTheme.add_search_path(iconsDirectory);

    // Load relevant settings
    const extensionSettings = this.getSettings();
    const schema_id = extensionSettings.schemaId;
    const allSettings: AllSettings = {
      extension: extensionSettings,
      sourceAPOD: this.getSettings(`${schema_id}.source.${apod.key}`),
      sourceStalenhag: this.getSettings(`${schema_id}.source.${stalenhag.key}`),
    };

    // Load image collection data
    const collections = await StalenhagCollections.loadImageCollections();
    // Add pages to the window.
    window.add(new SourcesPage(allSettings, collections));
    window.add(new AboutPage(this.metadata));

    // Attach our settings to the window to keep them alive as long as the window lives
    window._settings = allSettings;
  }
}
