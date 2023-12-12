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

import Gio from "gi://Gio";

import { CancellableResult, runCancellable } from "../common/gio.js";
import { Destructible } from "../common/lifecycle.js";
import { ImageFile } from "../download.js";

/**
 * An ongoing download.
 */
interface CurrentDownload {
  /**
   * Cancel the ongoing download.
   */
  readonly cancellable: Gio.Cancellable;
  /**
   * The result of the download.
   */
  readonly promise: Promise<CancellableResult<ImageFile>>;
}

/**
 * Schedule downloads.
 *
 * Currently this class permits just one ongoing image download, and cancels
 * ongoing downloads when a new download is requested.
 */
export class DownloadScheduler implements Destructible {
  private currentDownload: CurrentDownload | null = null;

  /**
   * Whether a download is ongoing.
   */
  get downloadOngoing(): boolean {
    return this.currentDownload !== null;
  }

  /**
   * Cancel the current download if any.
   *
   * @returns A promise which completes once the download is fully cancelled
   */
  cancelCurrentDownload(): Promise<void> {
    if (this.currentDownload === null) {
      return Promise.resolve();
    } else {
      console.log("Cancelling ongoing download");
      this.currentDownload.cancellable.cancel();
      return this.currentDownload.promise
        .then(() => {
          return;
        })
        .catch(() => {
          return;
        });
    }
  }

  /**
   * Cancel any ongoing download when destroyed.
   */
  destroy(): void {
    void this.cancelCurrentDownload();
  }

  private doDownload(
    download: (cancellable: Gio.Cancellable) => Promise<ImageFile>,
  ): Promise<CancellableResult<ImageFile>> {
    const [promise, cancellable] = runCancellable(download);
    this.currentDownload = { promise, cancellable };
    return promise.finally(() => {
      this.currentDownload = null;
    });
  }

  /**
   * Start a new download if no download is ongoing, otherwise return the ongoing download.
   */
  async maybeStartDownload(
    download: (cancellable: Gio.Cancellable) => Promise<ImageFile>,
  ): Promise<CancellableResult<ImageFile>> {
    if (this.currentDownload) {
      return this.currentDownload.promise;
    } else {
      console.log("Starting image download");
      return this.doDownload(download);
    }
  }

  /**
   * Force a new download.
   *
   * Cancel the current download and wait until it is fully cancelled; then
   * start the new download.
   *
   * @param download The download function
   * @returns The result of the download
   */
  async forceStartDownload(
    download: (cancellable: Gio.Cancellable) => Promise<ImageFile>,
  ): Promise<CancellableResult<ImageFile>> {
    await this.cancelCurrentDownload();
    return this.doDownload(download);
  }
}
