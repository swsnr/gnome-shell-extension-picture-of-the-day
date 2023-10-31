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

import { Image } from "./source";
import { CancellableResult, runCancellable } from "./gio";

interface CurrentDownload {
  readonly cancellable: Gio.Cancellable;
  readonly promise: Promise<CancellableResult<Image>>;
}

export class DownloadScheduler {
  private currentDownload: CurrentDownload | null = null;

  get downloadOngoing(): boolean {
    return this.currentDownload !== null;
  }

  cancelCurrentDownload(): Promise<void> {
    if (this.currentDownload === null) {
      return Promise.resolve();
    } else {
      return this.currentDownload.promise
        .finally(() => {
          this.currentDownload = null;
        })
        .then(() => {
          return;
        })
        .catch(() => {
          return;
        });
    }
  }

  async download(
    download: (cancellable: Gio.Cancellable) => Promise<Image>,
  ): Promise<CancellableResult<Image>> {
    await this.cancelCurrentDownload();
    const [promise, cancellable] = runCancellable(download);
    this.currentDownload = { promise, cancellable };
    return promise.finally(() => {
      this.currentDownload = null;
    });
  }
}
