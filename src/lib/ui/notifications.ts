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

import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";
import {
  NotificationDestroyedReason,
  NotificationGenericPolicy,
  Source,
} from "resource:///org/gnome/shell/ui/messageTray.js";

import { IconLoader } from "./icons.js";

/**
 * A notification source for notifications of this extension.
 */
export const PictureOfTheDaySource = GObject.registerClass(
  class PictureOfTheDaySource extends Source {
    private readonly icon: Gio.Icon;

    constructor(loader: IconLoader) {
      super(_("Picture of the Day"), "picture-of-the-day-symbolic");
      this.icon = loader.loadIcon(this.iconName);

      this.policy = new NotificationGenericPolicy();
    }

    /**
     * Return the icon for this source, i.e. the icon of this extension.
     *
     * @returns The logo of this extension.
     */
    override getIcon(): Gio.Icon {
      return this.icon;
    }

    override destroy(
      reason: NotificationDestroyedReason = NotificationDestroyedReason.EXPIRED,
    ): void {
      super.destroy(reason);
    }
  },
);

export type PictureOfTheDaySource = InstanceType<typeof PictureOfTheDaySource>;
