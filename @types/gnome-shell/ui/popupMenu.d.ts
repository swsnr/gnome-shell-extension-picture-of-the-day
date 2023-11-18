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

import St from "gi://St";
import Clutter from "gi://Clutter";
import Gio from "gi://Gio";

import { EventEmitter } from "resource:///org/gnome/shell/misc/signals.js";

// PopupMenuBase.addMenuItem checks these types quite explicitly
export type PopupMenuItemType =
  // eslint-disable-next-line no-use-before-define
  | PopupMenuSection
  // eslint-disable-next-line no-use-before-define
  | PopupSubMenuMenuItem
  // eslint-disable-next-line no-use-before-define
  | PopupSeparatorMenuItem
  // eslint-disable-next-line no-use-before-define
  | PopupBaseMenuItem;

export interface PopupMenuBaseSignals {
  readonly "notify::sensitive": [];
  readonly "active-changed": [item: PopupMenuItemType];
  readonly destroy: [];
}

export declare class PopupMenuBase<
  Signals = PopupMenuBaseSignals,
> extends EventEmitter<Signals> {
  removeAll(): void;

  addMenuItem(item: PopupMenuItemType, position?: number): void;

  addAction(
    title: string,
    callback: (event: Clutter.Event) => void,
    icon?: string | Gio.Icon,
  ): void;
}

export interface PopupMenuSignals extends PopupMenuBaseSignals {
  readonly "open-state-changed": [isOpen: boolean];
}

export declare class PopupMenu<
  Signals = PopupMenuSignals,
> extends PopupMenuBase<Signals> {}

export interface PopupSubMenuSignals extends PopupMenuBaseSignals {
  readonly "open-state-changed": [isOpen: boolean];
}

export declare class PopupSubMenu<
  Signals = PopupSubMenuSignals,
> extends PopupMenuBase<Signals> {}

export interface PopupMenuSectionSignals extends PopupMenuBaseSignals {
  readonly "open-state-changed": [isOpen: boolean];
}

export declare class PopupMenuSection<
  Signals = PopupMenuSectionSignals,
> extends PopupMenuBase<Signals> {
  constructor();
}

export declare class PopupBaseMenuItem extends St.BoxLayout {}

export declare class PopupMenuItem extends PopupBaseMenuItem {
  constructor(text: string, params?: unknown);

  label: St.Label;
}

export declare class PopupImageMenuItem extends PopupBaseMenuItem {
  constructor(text: string, icon: string | Gio.Icon, params?: unknown);

  setIcon(icon: string | Gio.Icon): void;
}

export declare class PopupSeparatorMenuItem extends PopupBaseMenuItem {
  constructor(text?: string);
}

export declare class PopupSubMenuMenuItem extends PopupBaseMenuItem {
  constructor(text?: string, wantIcon?: boolean);

  readonly menu: PopupSubMenu;
}
