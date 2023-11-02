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

const getTemplateUri = (templateDirectory: Gio.File, name: string): string => {
  const template = templateDirectory.get_child(`${name}.ui`).get_uri();
  if (template === null) {
    throw new Error(
      `Failed to get URI for template ${name}.ui in ${templateDirectory.get_path()}`,
    );
  }
  return template;
};

interface SourcesPageChildren {
  readonly _apodGroup: Adw.PreferencesGroup;
  readonly _apodApiKey: Adw.EntryRow;
}

interface AboutPageChildren {
  readonly _extensionName: Gtk.Label;
  readonly _extensionDescription: Gtk.Label;
  readonly _linkGithub: Gtk.LinkButton;
  readonly _linkIssues: Gtk.LinkButton;
  readonly _extensionLicense: Gtk.TextView;
}

interface WindowSettingRegistry {
  _settings: Gio.Settings;
  _sourceSettings: Map<string, Gio.Settings>;
}

export default class PictureOfTheDayPreferences extends ExtensionPreferences {
  /**
   * Load all pages.
   *
   * @param templateDirectory The directory for UI templates
   * @param settings A registry for settings
   * @returns All page classes
   */
  private loadPages(
    templateDirectory: Gio.File,
    settings: WindowSettingRegistry,
  ) {
    const getSettings = (schema: string): Gio.Settings =>
      this.getSettings(schema);

    const SourcesPage = GObject.registerClass(
      {
        GTypeName: "SourcesPage",
        Template: getTemplateUri(templateDirectory, "SourcesPage"),
        InternalChildren: ["apodGroup", "apodApiKey"],
      },
      class SourcesPage extends Adw.PreferencesPage {
        constructor() {
          super();

          const apodSettings = getSettings(
            `${settings._settings.schema_id}.source.${apod.key}`,
          );

          const children = this as unknown as SourcesPageChildren;
          children._apodGroup.title = apod.name;
          children._apodGroup.description = `<a href="${apod.website}">${apod.website}</a>`;
          apodSettings.bind(
            "api-key",
            children._apodApiKey,
            "text",
            Gio.SettingsBindFlags.DEFAULT,
          );
        }
      },
    );

    const AboutPage = GObject.registerClass(
      {
        GTypeName: "AboutPage",
        Template: getTemplateUri(templateDirectory, "AboutPage"),
        InternalChildren: [
          "extensionName",
          "extensionDescription",
          "linkGithub",
          "linkIssues",
          "extensionLicense",
        ],
      },
      class AboutPage extends Adw.PreferencesPage {
        constructor(metadata: ExtensionMetadata) {
          super();

          // TODO: Find a better way to declare that an instance has a set of props
          const children = this as unknown as AboutPageChildren;
          children._extensionName.set_text(metadata.name);
          children._extensionDescription.set_text(metadata.description);
          children._linkGithub.set_uri(metadata.url);
          children._linkIssues.set_uri(`${metadata.url}/issues`);
          children._extensionLicense.buffer.set_text(LICENSE, -1);
        }
      },
    );

    return { AboutPage, SourcesPage };
  }

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

    // Attach our settings to the window to keep them alive as long as the window lives
    window._settings = this.getSettings();
    window._sourceSettings = new Map();

    // Load pages from templates and add them to the window.
    const uiDir = this.metadata.dir.get_child("ui");
    const Pages = this.loadPages(uiDir, window);
    window.add(new Pages.SourcesPage());
    window.add(new Pages.AboutPage(this.metadata));
  }
}
