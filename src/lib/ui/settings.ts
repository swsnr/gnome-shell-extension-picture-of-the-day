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

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Shell from "gi://Shell";

/**
 * Launch a system settings panel.
 *
 * Taken from network.js in GNOME shell.
 *
 * @param panel The panel to launch
 * @param args Arguments for the panel
 */
export const launchSettingsPanel = (
  panel: string,
  ...args: readonly string[]
): void => {
  const param = new GLib.Variant("(sav)", [
    panel,
    args.map((s) => new GLib.Variant("s", s)),
  ]);
  const platformData = {
    "desktop-startup-id": new GLib.Variant(
      "s",
      `_TIME${Shell.Global.get().get_current_time()}`,
    ),
  };
  try {
    Gio.DBus.session.call(
      "org.gnome.Settings",
      "/org/gnome/Settings",
      "org.freedesktop.Application",
      "ActivateAction",
      new GLib.Variant("(sava{sv})", ["launch-panel", [param], platformData]),
      null,
      Gio.DBusCallFlags.NONE,
      -1,
      null,
      null,
    );
  } catch (e) {
    console.error("Failed to launch Settings panel", e);
  }
};
