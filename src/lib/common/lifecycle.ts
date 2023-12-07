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
 * Something we can destroy.
 */
export interface Destructible {
  destroy(): void;
}

// TODO: We could probably replace this with SignalTracker from GNOME Shell, but
// it looks like a nightmare to type, and I haven't groked completely how it's
// supposed to work.
/**
 * Track signal connections of other objects to disconnect them at once.
 */
export class SignalConnectionTracker implements Destructible {
  private readonly signals: [GObject.Object, number][] = [];

  track(obj: GObject.Object, id: number): void {
    this.signals.push([obj, id]);
  }

  destroy(): void {
    let signalConnection: [GObject.Object, number] | undefined;
    while ((signalConnection = this.signals.pop())) {
      const [obj, signal] = signalConnection;
      obj.disconnect(signal);
    }
  }
}

/**
 * A destroyer of things.
 *
 * Tracks destructible objects and destroys them all when it itself is destroyed.
 */
export class Destroyer implements Destructible {
  private readonly destructibles: Destructible[] = [];

  /**
   * Track a destructible object.
   *
   * The object is destroyed when this destroyer gets destroyed.
   *
   * @param destructible The object to track
   * @returns `destructible`
   */
  add<T extends Destructible>(destructible: T): T {
    this.destructibles.push(destructible);
    return destructible;
  }

  /**
   * Destroy all tracked destructible objects.
   */
  destroy(): void {
    let destructible: Destructible | undefined;
    while ((destructible = this.destructibles.pop())) {
      try {
        destructible.destroy();
      } catch (error) {
        console.error("Failed to destroy object", destructible, error);
      }
    }
  }
}

/**
 * Initialize resources safely.
 *
 * Call the given `initialize` function with a fresh `Destroyer`.  If `initialize` throws an error, take care to invoke
 * `destroy` of the destroyer object, to avoid leaking resources upon partial initialization.
 *
 * `initialize` just needs to register all destrucible objects on the passed `destroyer`.
 *
 * @param initialize A function to initialize some resources.
 * @returns The destroyer which groups all initialized resources.
 */
export const initializeSafely = (
  initialize: (destroyer: Destroyer) => void,
): Destructible => {
  const destroyer = new Destroyer();
  try {
    initialize(destroyer);
  } catch (error) {
    destroyer.destroy();
    throw error;
  }

  return destroyer;
};
