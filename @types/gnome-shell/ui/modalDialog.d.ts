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
import Shell from "gi://Shell";

import {
  Dialog,
  DialogButtonInfo,
} from "resource:///org/gnome/shell/ui/dialog.js";

export declare enum State {
  OPENED = 0,
  CLOSED = 1,
  OPENING = 2,
  CLOSING = 3,
  FADED_OUT = 4,
}

export interface DialogButtonInfo {
  readonly label: string;
  readonly action: () => void;
  readonly isDefault?: boolean;
  readonly key?: number;
}

export interface ModalDialogParams {
  readonly shellReactive?: boolean;
  readonly styleClass?: string | null;
  readonly actionMode?: Shell.ActionMode;
  readonly shouldFadeIn?: boolean;
  readonly shouldFadeOut?: boolean;
  readonly destroyOnClose?: boolean;
}

export declare class ModalDialog extends St.Widget {
  readonly state: State;
  readonly dialogLayout: Dialog;
  readonly contentLayout: Dialog["contentLayout"];
  readonly buttonLayout: Dialog["buttonLayout"];

  constructor(params?: ModalDialogParams);

  clearButtons(): void;
  setButtons(buttons: readonly DialogButtonInfo[]): void;
  addButton(buttonInfo: DialogButtonInfo): St.Button;
  setInitialKeyFocus(actor: Clutter.Actor): void;
  open(timestamp?: number, onPrimary?: boolean): void;
  close(timestamp?: number): void;
  popModal(timestamp?: number): void;
  pushModal(timestamp?: number): void;
}
