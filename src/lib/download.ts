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

export class DownloadScheduler {
  private currentDownloadCancellable: Gio.Cancellable | null = null;

  cancelCurrentDownload(): void {
    this.currentDownloadCancellable?.cancel();
    this.currentDownloadCancellable = null;
  }

  async download(
    download: (cancellable: Gio.Cancellable) => Promise<Image>,
  ): Promise<Image> {
    this.cancelCurrentDownload();
    this.currentDownloadCancellable = new Gio.Cancellable();
    return download(this.currentDownloadCancellable);
  }
}