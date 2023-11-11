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
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";

import {
  ExtensionPreferences,
  ExtensionMetadata,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import apod from "./lib/sources/metadata/apod.js";

const LICENSE = `Copyright Sebastian Wiesner <sebastian@swsnr.de>

This programm is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.

Alternatively, this program may be used under the terms
of the GNU General Public License Version 2 or later, as described below:

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.`;

const getTemplate = (name: string): string => {
  const uri = GLib.uri_resolve_relative(
    import.meta.url,
    `ui/${name}.ui`,
    GLib.UriFlags.NONE,
  );
  if (uri === null) {
    throw new Error(`Failed to resolve URI for template ${name}!`);
  }
  return uri;
};

interface AllSettings {
  readonly extension: Gio.Settings;
  readonly sourceAPOD: Gio.Settings;
}

interface SourcesPageChildren {
  readonly _apodGroup: Adw.PreferencesGroup;
  readonly _apodApiKey: Adw.EntryRow;
}

const SourcesPage = GObject.registerClass(
  {
    GTypeName: "SourcesPage",
    Template: getTemplate("SourcesPage"),
    InternalChildren: ["apodGroup", "apodApiKey"],
  },
  class SourcesPage extends Adw.PreferencesPage {
    constructor(settings: AllSettings) {
      super();

      const children = this as unknown as SourcesPageChildren;
      children._apodGroup.title = apod.name;
      children._apodGroup.description = `<a href="${apod.website}">${apod.website}</a>`;
      settings.sourceAPOD.bind(
        "api-key",
        children._apodApiKey,
        "text",
        Gio.SettingsBindFlags.DEFAULT,
      );
    }
  },
);

interface AboutPageChildren {
  readonly _extensionName: Gtk.Label;
  readonly _extensionDescription: Gtk.Label;
  readonly _extensionVersion: Gtk.Label;
  readonly _linkGithub: Gtk.LinkButton;
  readonly _linkIssues: Gtk.LinkButton;
  readonly _extensionLicense: Gtk.TextView;
}

const AboutPage = GObject.registerClass(
  {
    GTypeName: "AboutPage",
    Template: getTemplate("AboutPage"),
    InternalChildren: [
      "extensionName",
      "extensionVersion",
      "extensionDescription",
      "linkGithub",
      "linkIssues",
      "extensionLicense",
    ],
  },
  class AboutPage extends Adw.PreferencesPage {
    constructor(metadata: ExtensionMetadata) {
      super();

      const children = this as unknown as AboutPageChildren;
      children._extensionName.set_text(metadata.name);
      if (metadata["version-name"]) {
        children._extensionVersion.set_text(metadata["version-name"]);
      } else {
        children._extensionVersion.visible = false;
      }
      children._extensionDescription.set_text(metadata.description);
      children._linkGithub.set_uri(metadata.url);
      children._linkIssues.set_uri(`${metadata.url}/issues`);
      children._extensionLicense.buffer.set_text(LICENSE, -1);
    }
  },
);

interface WindowSettingRegistry {
  _settings: AllSettings;
}

export default class PictureOfTheDayPreferences extends ExtensionPreferences {
  override fillPreferencesWindow(
    window: Adw.PreferencesWindow & WindowSettingRegistry,
  ): void {
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
    const allSettings: AllSettings = {
      extension: extensionSettings,
      sourceAPOD: this.getSettings(
        `${extensionSettings.schema_id}.source.${apod.key}`,
      ),
    };

    // Add pages to the window.
    window.add(new SourcesPage(allSettings));
    window.add(new AboutPage(this.metadata));

    // Attach our settings to the window to keep them alive as long as the window lives
    window._settings = allSettings;
  }
}
