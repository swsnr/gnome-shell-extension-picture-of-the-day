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

import { Destroyer, Destructible, initializeSafely } from "./lifecycle.js";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

/**
 * An abstract class representing a destructible extension.
 *
 * This class handles the infrastructure for enabling and disabling the
 * extension; implementations only need to provide initialization.
 */
export abstract class DestructibleExtension extends Extension {
  private enabledExtension?: Destructible | null;

  /**
   * Initialize this extension.
   *
   * Implementations should register all their resources on the `given`
   * destroyer which gets destroyed when the extension is disabled.
   *
   * @param destroyer An object to register all resources on
   */
  abstract initialize(destroyer: Destroyer): void;

  /**
   * Enable this extension.
   *
   * If not already enabled, call `initialize` and keep track its allocated resources.
   */
  override enable(): void {
    if (this.enabledExtension) {
      console.log(
        `Enabling extension ${this.metadata.uuid} ${this.metadata["version-name"]}`,
      );
      this.enabledExtension = initializeSafely((destroyer) => {
        this.initialize(destroyer);
      });
      console.log(
        `Extension ${this.metadata.uuid} ${this.metadata["version-name"]} successfully enabled`,
      );
    }
  }

  /**
   * Disable this extension.
   *
   * If existing, destroy the allocated resources of `initialize`.
   */
  override disable(): void {
    console.log(
      `Disabling extension ${this.metadata.uuid} ${this.metadata["version-name"]}`,
    );
    this.enabledExtension?.destroy();
    this.enabledExtension = null;
  }
}
