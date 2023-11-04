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

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";
import { Notification } from "resource:///org/gnome/shell/ui/messageTray.js";

import { IconLoader } from "../ui/icons.js";
import { PictureOfTheDaySource } from "../ui/notifications.js";
import { ErrorDetailDialog } from "../ui/error-detail-dialog.js";

/**
 * Handle user-visible errors.
 */
export class RefreshErrorHandler {
  constructor(private readonly iconLoader: IconLoader) {}

  /**
   * Show the given error to the user.
   *
   * This class inspects the given error to some detail to provide the user
   * with a decent error message.
   *
   * @param error The error to show
   */
  showError(error: unknown): void {
    const source = new PictureOfTheDaySource(this.iconLoader);
    Main.messageTray.add(source);
    const notification = new Notification(
      source,
      _("Picture of the Day failed"),
      _("We are sorry but there seems to be an error"),
    );
    notification.setForFeedback(true);
    notification.addAction(_("Details"), () => {
      this.showErrorDetails(error);
    });
    notification.source.showNotification(notification);
  }

  /**
   * Show all details of the given error in a dedicated dialog.
   *
   * In this dialog, include the internal error message and the entire stack trace.
   *
   * @param error The error to show
   */
  showErrorDetails(error: unknown): void {
    const dialog = new ErrorDetailDialog({
      // Don't block the shell while we're showing an error.
      // Doesn't seem to do what I expect though...
      shellReactive: true,
      destroyOnClose: true,
    });
    dialog.showError(error);
    dialog.open(undefined, true);
  }
}
