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

import type GObject from "@girs/gobject-2.0";
import type GLib from "@girs/glib-2.0";
import type Gio from "@girs/gio-2.0";
import type St from "@girs/st-13";

export declare enum Urgency {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export declare enum PrivacyScope {
  USER = 0,
  SYSTEM = 1,
}

export declare enum NotificationDestroyedReason {
  EXPIRED = 1,
  DISMISSED = 2,
  SOURCE_CLOSED = 3,
  REPLACED = 4,
}

export declare class NotificationPolicy extends GObject.Object {
  readonly enable: boolean;
  readonly enableSound: boolean;
  readonly showBanners: boolean;
  readonly forceExpanded: boolean;
  readonly showInLockScreen: boolean;
  readonly detailsInLockScreen: boolean;

  store(): void;
  destroy(): void;
}

export declare class NotificationGenericPolicy extends NotificationPolicy {}

export declare class Source extends GObject.Object {
  iconName: string;

  policy: NotificationPolicy;

  constructor(title: string, iconName: string);

  setTitle(newTitle: string): void;
  // eslint-disable-next-line no-use-before-define
  createBanner(notification: Notification): void;
  createIcon(size: number): void;
  getIcon(): Gio.Icon;
  // eslint-disable-next-line no-use-before-define
  pushNotification(notification: Notification): void;
  // eslint-disable-next-line no-use-before-define
  showNotification(notification: Notification): void;
  destroy(reason: NotificationDestroyedReason): void;
  open(): void;
  destroyNonResidentNotifications(): void;
}

export interface NotificationParams {
  readonly gicon?: Gio.Icon;
  readonly secondaryGIcon?: Gio.Icon;
  readonly bannerMarkup?: boolean;
  readonly clear?: boolean;
  readonly datetime?: GLib.DateTime;
  readonly soundName?: string;
  readonly soundFile?: unknown;
}

export interface NotificationAction {
  readonly label: string;
  readonly callback: () => void;
}

export declare class Notification extends GObject.Object {
  readonly source: Source;
  readonly title: TextEncoderEncodeIntoResult;
  readonly urgency: Urgency;
  readonly isTransient: boolean;
  readonly privacyScope: PrivacyScope;
  readonly forFeedback: boolean;
  readonly bannerBodyText: string | null;
  readonly bannerBodyMarkup: boolean;
  readonly actions: readonly NotificationAction[];
  readonly resident?: boolean;
  readonly datetime?: GLib.DateTime;
  readonly gicon?: Gio.Icon;
  readonly secondaryGIcon?: Gio.Icon;

  constructor(
    source: Source,
    title?: string,
    banner?: string,
    params?: NotificationParams,
  );

  update(title: string, banner: string, params?: NotificationParams): void;
  addAction(
    label: NotificationAction["label"],
    callback: NotificationAction["callback"],
  ): void;
  setUrgency(urgency: Urgency): void;
  setResident(resident: boolean): void;
  setTransient(isTransient: boolean): void;
  setForFeedback(forFeedback: boolean): void;
  setPrivacyScope(privacyScope: PrivacyScope): void;
  playSound(): void;
  createBanner(): void;
  activate(): void;
  destroy(reason?: NotificationDestroyedReason): void;
}

export declare class MessageTray extends St.Widget {
  add(source: Source): void;
}
