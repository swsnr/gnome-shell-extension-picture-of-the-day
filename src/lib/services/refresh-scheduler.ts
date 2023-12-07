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

import { EventEmitter } from "resource:///org/gnome/shell/misc/signals.js";
import { RefreshService } from "./refresh.js";
import { IOError } from "../common/gio.js";
import { HttpRequestError } from "../network/http.js";
import { RateLimitedError } from "../source/errors.js";
import { RefreshErrorHandler } from "./refresh-error-handler.js";
import { Destructible } from "../common/lifecycle.js";
import { Timer, TimerRegistry } from "./timer-registry.js";

interface RefreshSchedulerSignals {
  "refresh-completed": [timestamp: GLib.DateTime];
}

const ONE_HOUR_S = 3600;
const ONE_MINUTE_S = 60;

// By default check every six hours, if there's a new image.
const DEFAULT_REFRESH_INTERVAL_S = 6 * ONE_HOUR_S;

// In case of error refresh every ten minutes, for up to 30 minutes total.
// Afterwards fall back to the regular refresh interval again.
const ERROR_REFRESH_INTERVAL_S = 10 * ONE_MINUTE_S;
const ERROR_REFRESH_LIMIT = 3;

/**
 * Schedule regular refreshes of the picture of the day.
 */
export class RefreshScheduler
  extends EventEmitter<RefreshSchedulerSignals>
  implements Destructible
{
  lastRefresh: GLib.DateTime | null = null;
  private timer: Timer | null = null;
  private errorRefreshCount = 0;

  constructor(
    private readonly refresh: RefreshService,
    private readonly errorHandler: RefreshErrorHandler,
    private readonly timerRegistry: TimerRegistry,
  ) {
    super();
  }

  /** Start refreshing on schedule. */
  start(): void {
    if (this.timer !== null) {
      /// We're already running
      return;
    }
    if (this.lastRefresh === null) {
      console.log("Last refresh not known, refreshing immediately");
      this.doRefresh();
    } else {
      const now = GLib.DateTime.new_now_utc();
      const diff_mus = now.difference(this.lastRefresh);
      if (DEFAULT_REFRESH_INTERVAL_S * GLib.TIME_SPAN_SECOND <= diff_mus) {
        // We already missed a refresh interval, so let's refresh now
        console.log(
          `Last refresh was at ${this.lastRefresh.format_iso8601()}, more than ${DEFAULT_REFRESH_INTERVAL_S}s ago, refreshing immediately`,
        );
        this.doRefresh();
      } else {
        // Schedule the next refresh in such a way as to maintain our six hour window,
        // but at least one minute from now.
        const next_s = Math.round(
          Math.max(
            1 * GLib.TIME_SPAN_MINUTE,
            DEFAULT_REFRESH_INTERVAL_S * GLib.TIME_SPAN_SECOND - diff_mus,
          ) / GLib.TIME_SPAN_SECOND,
        );

        console.log(
          `Last refresh was at ${this.lastRefresh.format_iso8601()}, scheduling a regular refresh in ${next_s}s`,
        );
        this.scheduleRegularRefresh(next_s);
      }
    }
  }

  /** Stop schedule refreshes. */
  stop(): void {
    this.timer?.stop();
    this.timer = null;
  }

  /**
   * Destroy all resources claimed by this service.
   *
   * Simply calls stop internally to remove the scheduled timer source, if any.
   */
  destroy(): void {
    this.disconnectAll();
    this.stop();
  }

  private doRefresh(): void {
    // After this function returns our timer is done, so we can already clear it
    this.timer = null;
    this.refresh
      .refresh()
      .then(() => {
        // We don't care whether the refresh was successful or cancelled here,
        // we performed a refresh in any case, and if the user cancelled it
        // manually that's no reason to change our schedule.
        this.errorRefreshCount = 0;
        this.lastRefresh = GLib.DateTime.new_now_utc();
        console.log(
          `Automatic refresh completed successfully at ${this.lastRefresh.format_iso8601()}`,
        );
        this.emit("refresh-completed", this.lastRefresh);
        this.scheduleRegularRefresh();
        return;
      })
      .catch((error) => {
        // The refresh failed, so we inspect the error to figure out what's the
        // problem, and schedule a more aggressive retry for some errors.
        if (
          error instanceof IOError ||
          error instanceof HttpRequestError ||
          error instanceof RateLimitedError
        ) {
          this.tryScheduleFasterRefreshesAfterError(error);
        } else {
          // For othe errors show the error to the user and try again at the
          // regular interval.
          const connectivity = Gio.NetworkMonitor.get_default().connectivity;
          if (connectivity === Gio.NetworkConnectivity.FULL) {
            // Only show error if we're actually fully connected to the internet,
            // otherwise the error is likely missing network connectivity, and
            // we shouldn't spam the user about the obivous fact that they're not
            // connect to a network.
            this.errorHandler.showError(error);
          } else {
            console.warn(
              `Failed to refresh automatically, resuming at regular interval`,
            );
          }
          this.scheduleRegularRefresh();
        }
        return;
      });
  }

  private tryScheduleFasterRefreshesAfterError(error: unknown): void {
    this.errorRefreshCount += 1;
    if (ERROR_REFRESH_LIMIT < this.errorRefreshCount) {
      console.warn(
        `Fast refresh limit ${ERROR_REFRESH_LIMIT} hit, reverting to regular refreshes`,
      );
      // We tried more frequent refreshes for a few times, but to no avail, so
      // show the last error to the user, and refresh again at the regular interval.
      this.errorHandler.showError(error);
      this.scheduleRegularRefresh();
    } else {
      console.log(
        `Scheduling fast refresh after error in ${ERROR_REFRESH_INTERVAL_S}s`,
      );
      this.timer = this.timerRegistry.oneshotSeconds(
        ERROR_REFRESH_INTERVAL_S,
        () => {
          this.doRefresh();
        },
      );
    }
  }

  private scheduleRegularRefresh(interval_s?: number): void {
    const timeout_s = interval_s ?? DEFAULT_REFRESH_INTERVAL_S;
    console.log(`Scheduling refresh of Picture of the Day in ${timeout_s}s`);
    this.timer = this.timerRegistry.oneshotSeconds(timeout_s, () => {
      this.doRefresh();
    });
  }
}
