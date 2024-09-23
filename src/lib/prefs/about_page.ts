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
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";

import type { ExtensionMetadata } from "@girs/gnome-shell/extensions/extension";

import { getTemplate } from "./template.js";

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

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
interface PictureOfTheDayAboutPage {
  readonly _extensionName: Gtk.Label;
  readonly _extensionDescription: Gtk.Label;
  readonly _extensionVersion: Gtk.Label;
  readonly _linkGithub: Gtk.LinkButton;
  readonly _linkIssues: Gtk.LinkButton;
  readonly _extensionLicense: Gtk.TextView;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class PictureOfTheDayAboutPage extends Adw.PreferencesPage {
  constructor(metadata: ExtensionMetadata) {
    super();

    this._extensionName.set_text(metadata.name);
    if (metadata["version-name"]) {
      this._extensionVersion.set_text(metadata["version-name"]);
    } else {
      this._extensionVersion.visible = false;
    }
    if (metadata.url) {
      this._linkGithub.set_uri(metadata.url);
      this._linkIssues.set_uri(`${metadata.url}/issues`);
    } else {
      this._linkGithub.visible = false;
      this._linkIssues.visible = false;
    }
    this._extensionLicense.buffer.set_text(LICENSE, -1);
  }
}

export default GObject.registerClass(
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
  PictureOfTheDayAboutPage,
);
