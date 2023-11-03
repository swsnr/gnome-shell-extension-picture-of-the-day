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

import { EventEmitter } from "resource:///org/gnome/shell/misc/signals.js";

import { DownloadScheduler } from "../network/download.js";
import { DownloadImage, ImageFile } from "../source.js";

export type RefreshState = "ongoing" | "completed" | "cancelled" | "failed";

interface RefreshServiceSignals {
  /**
   * The refresh state changed.
   */
  readonly "state-changed": [state: RefreshState];

  /**
   * The image was refreshed successfully.
   */
  readonly "image-changed": [image: ImageFile];
}

/**
 * Refreshes the current image.
 *
 * Downloads the image of the day and notifies about a new image.
 */
export class RefreshService extends EventEmitter<RefreshServiceSignals> {
  private download: DownloadImage | null;
  private downloadScheduler: DownloadScheduler = new DownloadScheduler();

  constructor() {
    super();
    this.download = null;
  }

  /**
   * Change the downloader to use for refresing images.
   *
   * @param download The downloader to use for the next refresh.
   */
  setDownloader(download: DownloadImage): void {
    this.download = download;
  }

  private async doRefresh(): Promise<void> {
    if (this.download) {
      await this.downloadScheduler.cancelCurrentDownload();
      this.emit("state-changed", "ongoing");
      try {
        const image = await this.downloadScheduler.maybeStartDownload(
          this.download,
        );
        console.log("image finished", image);
        this.emit("state-changed", image.result);
        if (image.result === "completed") {
          this.emit("image-changed", image.value);
        }
      } catch (error) {
        // TODO: Emit error signal and handle the error properly
        console.error("Refresh failed", error);
        if (error instanceof Error) {
          // Recursively log the inner causes of errorss
          let cause = error.cause;
          while (cause !== null) {
            if (cause instanceof Error) {
              console.error("Caused by", cause);
              cause = cause.cause;
            } else if (cause instanceof GLib.Error) {
              console.error("Caused by", cause);
              cause = null;
            } else {
              cause = null;
            }
          }
        }
        this.emit("state-changed", "failed");
      }
    }
  }

  /**
   * Trigger a refresh of the image
   */
  startRefresh(): void {
    void this.doRefresh();
  }

  /**
   * Cancel an ongoing refresh of the image.
   */
  cancelRefresh(): void {
    void this.downloadScheduler.cancelCurrentDownload();
  }
}
