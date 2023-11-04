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

import Clutter from "gi://Clutter";
import St from "gi://St";

export interface DialogButtonInfo {
  readonly label: string;
  readonly action: () => void;
  readonly isDefault?: boolean;
  readonly key?: number;
}

export declare class Dialog extends St.Widget {
  readonly contentLayout: St.BoxLayout;
  readonly buttonLayout: St.Widget;

  constructor(parentActor: Clutter.Actor, styleClass: string | null);

  makeInactive(): void;

  clearButtons(): void;

  addButton(buttonInfo: DialogButtonInfo): St.Button;
}

export declare class MessageDialogContent extends St.BoxLayout {
  title: string;
  description: string;
}

export interface ListSectionParams extends St.BoxLayout.ConstructorProperties {
  readonly title?: string;
}

export declare class ListSection extends St.BoxLayout {
  title: string;
  readonly list: St.BoxLayout;

  constructor(params?: ListSectionParams);
}

export interface ListSectionItemParams
  extends St.BoxLayout.ConstructorProperties {
  readonly title?: string;
  readonly description?: string;
  readonly iconActor?: Clutter.Actor;
}

export declare class ListSectionItem extends St.BoxLayout {
  title: string;
  description: string;
  iconActor: Clutter.Actor;

  constructor(params?: ListSectionItemParams);
}
