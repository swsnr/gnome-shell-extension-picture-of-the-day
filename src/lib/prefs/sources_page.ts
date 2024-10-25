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
  gettext as _,
  ngettext,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { getTemplate } from "./template.js";
import * as StalenhagCollections from "../sources/stalenhag/collections.js";
import { AllSettings } from "./settings.js";
import { SourceMetadata } from "../source/metadata.js";
import SOURCES from "../sources/metadata/all.js";
import { PromisifiedGtkFileDialog } from "../fixes.js";
import i18n from "../common/i18n.js";
import apod from "../sources/metadata/apod.js";
import stalenhag from "../sources/metadata/stalenhag.js";

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
interface PictureOfTheDaySourcesPage {
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

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class PictureOfTheDaySourcesPage extends Adw.PreferencesPage {
  constructor(
    private readonly settings: AllSettings,
    private readonly stalenhagCollections: readonly StalenhagCollections.ImageCollection[],
  ) {
    super();

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
          console.error("Failed to select download directory", error);
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
    const disabledCollections = new Set(
      this.settings.sourceStalenhag.get_strv("disabled-collections"),
    );
    for (const collection of this.stalenhagCollections) {
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
    }
    this.settings.sourceStalenhag.connect(
      "changed::disabled-collections",
      () => {
        this.showCountEnabledCollections();
      },
    );
    this.showCountEnabledCollections();
  }

  private showSelectedSource(source: SourceMetadata): void {
    this._sourcesRow.set_subtitle(
      `<a href="${source.website}">${source.name}</a>`,
    );
  }

  private showDownloadFolder() {
    const downloadDirectory = this.settings.extension
      .get_value("image-download-folder")
      .deepUnpack<string | null>();
    this._downloadFolder.set_subtitle(
      downloadDirectory ?? _("XDG State directory"),
    );
  }

  private async selectDownloadDirectory(): Promise<void> {
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

  private showCountEnabledCollections(): void {
    const disabled = this.settings.sourceStalenhag.get_strv(
      "disabled-collections",
    );
    const countEnabled = this.stalenhagCollections.length - disabled.length;
    this._stalenhagCollections.subtitle = i18n.format(
      ngettext(
        "%s/%s collection enabled",
        "%s/%s collections enabled",
        countEnabled,
      ),
      countEnabled,
      this.stalenhagCollections.length,
    );
  }
}

export default GObject.registerClass(
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
  PictureOfTheDaySourcesPage,
);
