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

/**
 * Something we can disconnect all signals from.
 */
export interface SignalDisconnectable {
  disconnectAll(): void;
}

// TODO: We could probably replace this with SignalTracker from GNOME Shell, but
// it looks like a nightmare to type, and I haven't groked completely how it's
// supposed to work.
/**
 * Track signal connections of other objects to disconnect them at once.
 */
export class SignalConnectionTracker implements SignalDisconnectable {
  private signals: [GObject.Object, number][] = [];

  track(obj: GObject.Object, id: number): void {
    this.signals.push([obj, id]);
  }

  disconnectAll(): void {
    for (const [obj, handlerId] of this.signals) {
      obj.disconnect(handlerId);
    }
  }
}

/**
 * Something we can destroy.
 */
export interface Destructible {
  destroy(): void;
}
