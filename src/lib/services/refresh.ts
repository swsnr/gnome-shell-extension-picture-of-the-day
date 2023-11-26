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

import { EventEmitter } from "resource:///org/gnome/shell/misc/signals.js";

import { DownloadScheduler } from "./download-scheduler.js";
import { DownloadImage, ImageFile } from "../source.js";
import { unfoldCauses } from "../util/error.js";
import { CancellableResult } from "../util/gio.js";
import { Destructible } from "../util/lifecycle.js";

export type RefreshState = "ongoing" | "completed" | "cancelled" | "failed";

interface RefreshServiceSignals {
  /**
   * The refresh state changed.
   */
  readonly "state-changed": [state: RefreshState];

  /**
   * The image was refreshed successfully.
   */
  readonly "refresh-completed": [image: ImageFile];
}

/**
 * Refreshes the current image.
 *
 * Downloads the image of the day and notifies about a new image.
 */
export class RefreshService
  extends EventEmitter<RefreshServiceSignals>
  implements Destructible
{
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

  /**
   * Trigger a refresh of the image
   *
   * @return A promise for the completed download
   */
  async refresh(): Promise<CancellableResult<ImageFile>> {
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
          this.emit("refresh-completed", image.value);
        }
        return image;
      } catch (error) {
        console.error("Refresh failed", error);
        for (const cause of unfoldCauses(error)) {
          console.error("Caused by", cause);
        }
        this.emit("state-changed", "failed");
        throw error;
      }
    } else {
      throw new Error("No download function configured yet");
    }
  }

  /**
   * Cancel an ongoing refresh of the image.
   */
  cancelRefresh(): Promise<void> {
    return this.downloadScheduler.cancelCurrentDownload();
  }

  destroy(): void {
    this.downloadScheduler.destroy();
    this.disconnectAll();
  }
}
