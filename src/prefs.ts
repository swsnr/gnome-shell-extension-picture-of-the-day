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
  ngettext,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import apod from "./lib/sources/metadata/apod.js";
import stalenhag from "./lib/sources/metadata/stalenhag.js";
import * as StalenhagCollections from "./lib/sources/stalenhag/collections.js";
import SOURCES from "./lib/sources/metadata/all.js";
import type { SourceMetadata } from "./lib/source/source.js";

import type { ExtensionMetadata } from "@girs/gnome-shell/extensions/extension";
import type { PromisifiedGtkFileDialog } from "./lib/fixes.js";
import i18n from "./lib/common/i18n.js";

Gio._promisify(Gio.File.prototype, "load_contents_async");
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

const getTemplate = (name: string): string =>
  GLib.uri_resolve_relative(
    import.meta.url,
    `ui/${name}.ui`,
    GLib.UriFlags.NONE,
  );

interface AllSettings {
  readonly extension: Gio.Settings;
  readonly sourceAPOD: Gio.Settings;
  readonly sourceStalenhag: Gio.Settings;
}

interface SourcesPageProperties {
  readonly _sourcesRow: Adw.ExpanderRow;
  readonly _apodGroup: Adw.PreferencesGroup;
  readonly _stalenhagGroup: Adw.PreferencesGroup;
  readonly _stalenhagCollections: Adw.ExpanderRow;
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
      "stalenhagGroup",
      "stalenhagCollections",
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
      (
        this as unknown as PictureOfTheDaySourcesPage & SourcesPageProperties
      ).initialize();
    }

    private showSelectedSource(
      this: PictureOfTheDaySourcesPage & SourcesPageProperties,
      source: SourceMetadata,
    ): void {
      this._sourcesRow.set_subtitle(
        `<a href="${source.website}">${source.name}</a>`,
      );
    }

    private showDownloadFolder(
      this: PictureOfTheDaySourcesPage & SourcesPageProperties,
    ) {
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
      const file = await (dialog as PromisifiedGtkFileDialog).select_folder(
        this.root as Gtk.Window,
      );
      if (file) {
        const value = new GLib.Variant("ms", file.get_uri());
        this.settings.extension.set_value("image-download-folder", value);
      } else {
        console.warn("No folder selected; dialog cancelled?");
      }
    }

    private toggleCollection(
      this: PictureOfTheDaySourcesPage & SourcesPageProperties,
      collection: StalenhagCollections.ImageCollection,
      enabled: boolean,
    ): void {
      const disabledCollections = new Set(
        this.settings.sourceStalenhag.get_strv("disabled-collections"),
      );
      if (enabled) {
        disabledCollections.delete(collection.tag);
      } else {
        disabledCollections.add(collection.tag);
      }
      this.settings.sourceStalenhag.set_strv(
        "disabled-collections",
        Array.from(disabledCollections),
      );
    }

    private showCountEnabledCollections(
      this: PictureOfTheDaySourcesPage & SourcesPageProperties,
      collections: readonly StalenhagCollections.ImageCollection[],
    ): void {
      const disabled = this.settings.sourceStalenhag.get_strv(
        "disabled-collections",
      );
      const countEnabled = collections.length - disabled.length;
      this._stalenhagCollections.subtitle = i18n.format(
        ngettext(
          "%s/%s collection enabled",
          "%s/%s collections enabled",
          countEnabled,
        ),
        countEnabled,
        collections.length,
      );
    }

    private initialize(
      this: PictureOfTheDaySourcesPage & SourcesPageProperties,
    ): void {
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
      const selectedSource = buttons.get(selectedKey)?.source;
      if (typeof selectedSource === "undefined") {
        throw new Error(`${selectedKey} does not denote a known source!`);
      }
      this.showSelectedSource(selectedSource);
      buttons.get(selectedKey)?.button.set_active(true);
      this.settings.extension.connect("changed::selected-source", () => {
        const newKey = this.settings.extension.get_string("selected-source");
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

      this._apodGroup.title = apod.name;
      this._apodGroup.description = `<a href="${apod.website}">${apod.website}</a>`;
      this.settings.sourceAPOD.bind(
        "api-key",
        this._apodApiKey,
        "text",
        Gio.SettingsBindFlags.DEFAULT,
      );

      this._stalenhagGroup.title = stalenhag.name;
      this._stalenhagGroup.description = `<a href="${stalenhag.website}">${stalenhag.website}</a>`;
      // Load all scraped image collections and add them as toggles to the expander.
      StalenhagCollections.loadImageCollections()
        .then((collections) => {
          const disabledCollections = new Set(
            this.settings.sourceStalenhag.get_strv("disabled-collections"),
          );
          collections.forEach((collection) => {
            const row = new Adw.SwitchRow({
              title: collection.title,
              subtitle: `<a href="${collection.url}">${collection.url}</a>`,
              active: !disabledCollections.has(collection.tag),
            });
            this.settings.sourceStalenhag.connect(
              "changed::disabled-collections",
              () => {
                row.active = !this.settings.sourceStalenhag
                  .get_strv("disabled-collections")
                  .includes(collection.tag);
              },
            );
            row.connect("notify::active", () => {
              this.toggleCollection(collection, row.active);
            });
            this._stalenhagCollections.add_row(row);
          });

          this.settings.sourceStalenhag.connect(
            "changed::disabled-collections",
            () => {
              this.showCountEnabledCollections(collections);
            },
          );
          this.showCountEnabledCollections(collections);
          return;
        })
        .catch((error: unknown) => {
          console.error("Failed to add buttons", error);
        });
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
    const allSettings: AllSettings = {
      extension: extensionSettings,
      sourceAPOD: this.getSettings(`${schema_id}.source.${apod.key}`),
      sourceStalenhag: this.getSettings(`${schema_id}.source.${stalenhag.key}`),
    };

    // Add pages to the window.
    window.add(new SourcesPage(allSettings));
    window.add(new AboutPage(this.metadata));

    // Attach our settings to the window to keep them alive as long as the window lives
    window._settings = allSettings;
  }
}
