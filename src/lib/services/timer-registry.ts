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

import { Destructible } from "../util/lifecycle.js";

/**
 * A running and active timer.
 */
export interface Timer {
  /**
   * Stop this timer.
   */
  stop(): void;
}

/**
 * Manage timers.
 *
 * Provides means to create timers, and allows to clean up all ongoing timers at once.
 */
export class TimerRegistry implements Destructible {
  private readonly timerSources = new Map<number, void>();

  oneshotSeconds(timeout: number, callback: () => void): Timer {
    const source = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      timeout,
      () => {
        try {
          callback();
        } catch (error) {
          console.error("Timer failed", error);
        }
        this.timerSources.delete(source);
        // Return false to stop the timer after the first invocation.
        return false;
      },
    );
    this.timerSources.set(source);
    return {
      stop: () => {
        this.removeSource(source);
      },
    };
  }

  /**
   * Remove a source from GLib and this registry.
   *
   * @param source The timer source to remove
   */
  private removeSource(source: number): void {
    GLib.source_remove(source);
    this.timerSources.delete(source);
  }

  /**
   * Remove all registered timers.
   */
  destroy(): void {
    for (const source of this.timerSources.keys()) {
      this.removeSource(source);
    }
  }
}
