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

import {
  gettext as _,
  pgettext,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as MessageTray from "resource:///org/gnome/shell/ui/messageTray.js";
import { EventEmitter } from "resource:///org/gnome/shell/misc/signals.js";

import { ErrorDetailDialog } from "../ui/error-detail-dialog.js";
import {
  ConfigurationError,
  InvalidAPIKeyError,
  NoPictureTodayError,
  NotAnImageError,
  RateLimitedError,
} from "../source/errors.js";
import { HttpRequestError } from "../network/http.js";
import { IOError } from "../common/gio.js";
import i18n from "../common/i18n.js";
import { Destructible } from "../common/lifecycle.js";

export interface RefreshErrorHandlerSignals {
  readonly "action::open-preferences": [];
  readonly "action::open-network-settings": [];
}

/**
 * Handle user-visible errors.
 */
export class RefreshErrorHandler
  extends EventEmitter<RefreshErrorHandlerSignals>
  implements Destructible
{
  constructor(private readonly source: MessageTray.Source) {
    super();
  }

  private showErrorInNotification(
    notification: MessageTray.Notification,
    error: unknown,
  ): void {
    // Pick some errors apart to figure how what's wrong.
    if (error instanceof InvalidAPIKeyError) {
      notification.title = pgettext(
        "Error notification",
        "Picture of the Day needs an API key",
      );
      notification.body = pgettext(
        "Error notification",
        "Please configure a valid API key for the configured source in the extensions settings.",
      );
      notification.addAction(
        pgettext("Error notification", "Open preferences"),
        () => {
          this.openPreferences();
        },
      );
    } else if (error instanceof RateLimitedError) {
      notification.title = pgettext(
        "Error notification",
        "Picture of the Day was rate-limited",
      );
      notification.body = pgettext(
        "Error notification",
        "The server for the configured source is rate-limited and does not permit to fetch an image currently. " +
          "Try again later, or try a different image source.",
      );
    } else if (error instanceof ConfigurationError) {
      notification.title = pgettext(
        "Error notification",
        "Picture of the Day has some invalid configuration",
      );
      notification.body = pgettext(
        "Error notification",
        "Please correct the invalid configuration in the extension settings.",
      );
      notification.addAction(
        pgettext("Error notification", "Open preferences"),
        () => {
          this.openPreferences();
        },
      );
    } else if (error instanceof HttpRequestError) {
      notification.title = pgettext(
        "Error notification",
        "Picture of the Day failed to fetch today's picture.",
      );
      if (
        Gio.NetworkMonitor.get_default().connectivity !==
        Gio.NetworkConnectivity.FULL
      ) {
        notification.body = pgettext(
          "Error notification",
          "The system seems to have limited network connectivity. Try to connect to the internet. " +
            "If the error persists, try again later.",
        );
        notification.addAction(
          pgettext("Error notification", "Open network settings"),
          () => {
            this.emit("action::open-network-settings");
          },
        );
      } else {
        notification.body = pgettext(
          "Error notification",
          "The server for the configured source seems to have issues. Try to configure a different image source or try again later.",
        );
      }
    } else if (error instanceof NotAnImageError) {
      notification.title = pgettext("Error notification", "No picture today");
      notification.body = i18n.format(
        pgettext(
          "Error notification",
          "%s is not an image, and cannot be used as background. You can perhaps view it directly on the website.",
        ),
        error.metadata.title,
      );
      if (error.metadata.url) {
        const url = error.metadata.url;
        notification.addAction(
          pgettext("Error notification", "Open website"),
          () => {
            Gio.app_info_launch_default_for_uri(
              url,
              global.create_app_launch_context(0, -1),
            );
          },
        );
      }
    } else if (error instanceof NoPictureTodayError) {
      notification.title = pgettext("Error notification", "No picture today");
      notification.body = i18n.format(
        pgettext(
          "Error notification",
          "%s does not provide a picture today.  Try again tomorrow, or try a different source.",
        ),
        error.source.name,
      );
    } else if (error instanceof IOError) {
      notification.title = pgettext(
        "Error notification",
        "Image could not be downloaded",
      );
      const description = pgettext(
        "Error notification",
        "An I/O error occurred while fetching today's image, with this message %s. Check your network connection and the permissions in the download folder.",
      );
      // If the inner error is a GLib error use its message instead of the wrapper message for better accuracy
      // and locatization.
      const errorMessage =
        (error.cause instanceof GLib.Error
          ? error.cause.message
          : error.message) ?? "";
      notification.body = i18n.format(description, errorMessage);
    }
  }

  private openPreferences(): void {
    this.emit("action::open-preferences");
  }

  /**
   * Show the given error to the user.
   *
   * This class inspects the given error to some detail to provide the user
   * with a decent error message.
   *
   * @param error The error to show
   */
  showError(error: unknown): void {
    const notification = new MessageTray.Notification({
      source: this.source,
      title: pgettext("Error notification", "Picture of the Day failed"),
      body: pgettext(
        "Error notification",
        "We are sorry but there seems to be an error.",
      ),
      forFeedback: true,
    });
    notification.addAction(_("Details"), () => {
      this.showErrorDetails(error);
    });
    this.showErrorInNotification(notification, error);
    this.source.addNotification(notification);
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
    dialog.openOnPrimary();
  }

  destroy(): void {
    this.disconnectAll();
  }
}
