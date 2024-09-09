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
import GLib from "gi://GLib";
import Pango from "gi://Pango";
import Clutter from "gi://Clutter";
import St from "gi://St";

import { pgettext } from "resource:///org/gnome/shell/extensions/extension.js";

import { ModalDialog } from "resource:///org/gnome/shell/ui/modalDialog.js";
import { unfoldCauses } from "../common/error.js";
import type { GLibErrorWithStack } from "../fixes.js";

/**
 * Shortcut for `GLib.markup_escape_text`.
 */
const e = (s: string): string => GLib.markup_escape_text(s, -1);

const formatStacktrace = (stack: string | undefined): string => {
  return (
    stack
      ?.split("\n")
      .map((l) => `  <i><small>${e(l)}</small></i>`)
      .join("\n") ?? `  <i><small>no stacktrace</small></i>`
  );
};

/**
 * Format a single error as pango markup.
 *
 * For regular Javascript errors, print the error name, the error message, and
 * the intended stack trace.
 *
 * Otherwise just stringify the object.
 */
const formatOneError = (error: unknown): string => {
  if (error instanceof Error) {
    const stack = formatStacktrace(error.stack);
    return `<b>${e(error.name)}: ${e(error.message)}</b>\n${stack}`;
  } else if (error instanceof GLib.Error) {
    const stack = formatStacktrace((error as GLibErrorWithStack).stack);
    return `<b>${error.toString()}</b>\n${stack}`;
  } else if (typeof error === "string") {
    return e(`<b>${error}</b>`);
  } else {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return e(`${error}`);
  }
};

/**
 * Build a complete error message for error, including all nested causes.
 */
const buildErrorMessage = (error: unknown): string => {
  const causes = unfoldCauses(error).map(
    (cause) => `Caused by: ${formatOneError(cause)}`,
  );
  return [`Error: ${formatOneError(error)}`, ...causes].join("\n");
};

/**
 * A dialog to show details of an error.
 */
export const ErrorDetailDialog = GObject.registerClass(
  class ErrorDetailDialog extends ModalDialog {
    private readonly messageLabel: St.Label;

    constructor(params?: Partial<ModalDialog.ConstructorProps>) {
      super(params);

      const contentBox = new St.BoxLayout({
        name: "error-detail-dialog-content-box",
        xExpand: true,
        yExpand: true,
        vertical: true,
        styleClass: "message-dialog-content",
        yAlign: Clutter.ActorAlign.FILL,
      });

      const scrollView = new St.ScrollView({
        name: "error-detail-dialog-scoll-view",
        style: "max-height: 300px",
      });

      const messageLayout = new St.BoxLayout({
        name: "error-detail-dialog-message-layout",
        vertical: true,
        xExpand: true,
        yExpand: true,
        yAlign: Clutter.ActorAlign.FILL,
        style: "spacing: 1m",
      });

      const explanationLabel = new St.Label({
        text: pgettext(
          "ErrorDetailDialog",
          "The following text contains the internal error messages and stacktraces of the error.  You may find additional details which may help you to fix the error, or you may use this data to report an issue on Github.",
        ),
      });
      explanationLabel.clutterText.lineWrap = true;

      this.messageLabel = new St.Label({
        name: "error-detail-dialog-message-label",
        // Expand the label in all directions, so that the scroll view can take over.
        xExpand: true,
        yExpand: true,
        style: "font-family: monospace; font-size: 9pt; font-weight: 400;",
      });
      // Show full text; don't ellipsize at widget border
      this.messageLabel.clutterText.ellipsize = Pango.EllipsizeMode.NONE;
      this.messageLabel.clutterText.selectable = true;

      this.setInitialKeyFocus(this.messageLabel);

      messageLayout.add_child(this.messageLabel);
      scrollView.add_child(messageLayout);
      contentBox.add_child(
        new St.Label({
          text: pgettext("ErrorDetailDialog", "Picture of the Day failed"),
          styleClass: "message-dialog-title",
        }),
      );
      contentBox.add_child(explanationLabel);
      contentBox.add_child(scrollView);
      this.contentLayout.add_child(contentBox);

      this.addButton({
        label: pgettext("ErrorDetailDialog", "Copy to clipboard"),
        action: () => {
          const text = this.messageLabel.get_text();
          const clipboard = St.Clipboard.get_default();
          clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
        },
      });
      this.addButton({
        label: pgettext("Error Dialog", "Close"),
        key: Clutter.KEY_Escape,
        action: () => {
          this.close();
        },
      });
    }

    openOnPrimary(): void {
      this.open();
    }

    /**
     * Set the error to show.
     */
    showError(error: unknown): void {
      this.messageLabel.clutterText.set_markup(buildErrorMessage(error));
    }
  },
);
