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
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import apod from "./lib/sources/metadata/apod.js";
import SOURCES from "./lib/sources/metadata/sources.js";
import { SourceMetadata } from "./lib/source.js";

import type { ExtensionMetadata } from "@girs/gnome-shell/extensions/extension";

Gio._promisify(Gtk.FileDialog.prototype, "select_folder");

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

interface SourcesPageProperties {
  readonly _sourcesRow: Adw.ExpanderRow;
  readonly _apodGroup: Adw.PreferencesGroup;
  readonly _apodApiKey: Adw.EntryRow;
  readonly _refreshAutomatically: Adw.SwitchRow;
  readonly _downloadFolder: Adw.ActionRow;
  readonly _selectDownloadFolder: Gtk.Button;
  readonly _resetDownloadFolder: Gtk.Button;
}

const SourcesPage = GObject.registerClass(
  {
    GTypeName: "PictureOfTheDaySourcesPage",
    Template: getTemplate("SourcesPage"),
    InternalChildren: [
      "apodGroup",
      "apodApiKey",
      "sourcesRow",
      "refreshAutomatically",
      "downloadFolder",
      "selectDownloadFolder",
      "resetDownloadFolder",
    ],
  },
  class PictureOfTheDaySourcesPage extends Adw.PreferencesPage {
    constructor(private readonly settings: AllSettings) {
      super();
      (this as unknown as PictureOfTheDaySourcesPage & SourcesPageProperties).initialize();
    }

    private showSelectedSource(
      this: PictureOfTheDaySourcesPage & SourcesPageProperties,
      source: SourceMetadata,
    ): void {
      this._sourcesRow.set_subtitle(
        `<a href="${source.website}">${source.name}</a>`,
      );
    }

    private showDownloadFolder(this: PictureOfTheDaySourcesPage & SourcesPageProperties) {
      const downloadDirectory = this.settings.extension
        .get_value("image-download-folder")
        .deepUnpack<string | null>();
      this._downloadFolder.set_subtitle(
        downloadDirectory ?? _("XDG State directory"),
      );
    }

    private async selectDownloadDirectory(
      this: PictureOfTheDaySourcesPage & SourcesPageProperties,
    ): Promise<void> {
      // ts-for-gir doesn't recognize "select_folder" as async function, so we
      // have to convince typescript explicitly that we have a promise here.
      const dialog = Gtk.FileDialog.new();
      dialog.acceptLabel = _("Select download folder");
      const picturesDirectory = GLib.get_user_special_dir(
        GLib.UserDirectory.DIRECTORY_PICTURES,
      );
      if (picturesDirectory) {
        dialog.initialFolder = Gio.file_new_for_path(picturesDirectory);
      }
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const file = await (dialog.select_folder(
        this.root as Gtk.Window,
        null,
      ) as unknown as Promise<Gio.File>);
      const value = new GLib.Variant("ms", file.get_uri());
      this.settings.extension.set_value("image-download-folder", value);
    }

    private initialize(this: PictureOfTheDaySourcesPage & SourcesPageProperties): void {
      // Fill the expander with all sources
      const buttons = new Map(
        SOURCES.map((source) => {
          const button = new Gtk.CheckButton();
          const row = new Adw.ActionRow({
            title: source.name,
            subtitle: `<a href="${source.website}">${source.website}</a>`,
          });
          row.add_suffix(button);
          button.connect("toggled", () => {
            if (button.active) {
              this.settings.extension.set_string("selected-source", source.key);
            }
          });
          this._sourcesRow.add_row(row);
          return [source.key, { source, button }];
        }),
      );

      Array.from(buttons.values())
        .map(({ button }) => button)
        .reduce((group, button) => {
          button.group = group;
          return group;
        });

      const selectedKey = this.settings.extension.get_string("selected-source");
      if (selectedKey === null) {
        throw new Error("'selected-source' is null?");
      }
      const selectedSource = buttons.get(selectedKey)?.source;
      if (typeof selectedSource === "undefined") {
        throw new Error(`${selectedKey} does not denote a known source!`);
      }
      this.showSelectedSource(selectedSource);
      buttons.get(selectedKey)?.button.set_active(true);
      this.settings.extension.connect("changed::selected-source", () => {
        const newKey = this.settings.extension.get_string("selected-source");
        if (newKey === null) {
          throw new Error("'selected-source' is null?");
        }
        const item = buttons.get(newKey);
        if (typeof item === "undefined") {
          throw new Error(`Source ${newKey} not known?`);
        }
        this.showSelectedSource(item.source);
        item.button.set_active(true);
      });

      this.showDownloadFolder();
      this.settings.extension.connect("changed::image-download-folder", () => {
        this.showDownloadFolder();
      });
      this._resetDownloadFolder.connect("clicked", () => {
        this.settings.extension.reset("image-download-folder");
      });
      this._selectDownloadFolder.connect("clicked", () => {
        this.selectDownloadDirectory().catch((error: unknown) => {
          if (
            error instanceof GLib.Error &&
            error.matches(
              Gtk.DialogError as unknown as number,
              Gtk.DialogError.DISMISSED,
            )
          ) {
            // The user dismissed the dialog; we'll do nothing in this case.
          } else {
            throw error;
          }
        });
      });

      this.settings.extension.bind(
        "refresh-automatically",
        this._refreshAutomatically,
        "active",
        Gio.SettingsBindFlags.DEFAULT,
      );

      this._apodGroup.description = `<a href="${apod.website}">${apod.name}</a>`;
      this.settings.sourceAPOD.bind(
        "api-key",
        this._apodApiKey,
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
    GTypeName: "PictureOfTheDayAboutPage",
    Template: getTemplate("AboutPage"),
    InternalChildren: [
      "extensionName",
      "extensionVersion",
      "linkGithub",
      "linkIssues",
      "extensionLicense",
    ],
  },
  class PictureOfTheDayAboutPage extends Adw.PreferencesPage {
    constructor(metadata: ExtensionMetadata) {
      super();

      const children = this as unknown as AboutPageChildren;
      children._extensionName.set_text(metadata.name);
      if (metadata["version-name"]) {
        children._extensionVersion.set_text(metadata["version-name"]);
      } else {
        children._extensionVersion.visible = false;
      }
      if (metadata.url) {
        children._linkGithub.set_uri(metadata.url);
        children._linkIssues.set_uri(`${metadata.url}/issues`);
      } else {
        children._linkGithub.visible = false;
        children._linkIssues.visible = false;
      }
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
    const schema_id = extensionSettings.schemaId;
    if (schema_id === null) {
      throw new Error("Schema ID of settings schema unexpectedly null?");
    }
    const allSettings: AllSettings = {
      extension: extensionSettings,
      sourceAPOD: this.getSettings(`${schema_id}.source.${apod.key}`),
    };

    // Add pages to the window.
    window.add(new SourcesPage(allSettings));
    window.add(new AboutPage(this.metadata));

    // Attach our settings to the window to keep them alive as long as the window lives
    window._settings = allSettings;
  }
}
