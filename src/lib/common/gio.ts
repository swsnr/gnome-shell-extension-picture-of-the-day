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

/**
 * A result of a cancellable.
 *
 * `{ result: "cancelled" }` if the operation was cancelled, or
 * `{ result: "completed", value: result }` where `result` is the return value
 * of the completed operation.
 */
export type CancellableResult<T> =
  | { readonly result: "cancelled" }
  | { readonly result: "completed"; readonly value: T };

/**
 * Whether `reason` is a GLib error denoting a cancelled IO operation.
 */
export const isGioErrorCancelled = (reason: unknown): reason is GLib.Error =>
  reason instanceof GLib.Error &&
  reason.matches(
    Gio.IOErrorEnum as unknown as number,
    Gio.IOErrorEnum.CANCELLED,
  );

/**
 * Run an IO operation as cancellable promise.
 *
 * @param run Create a cancellable promise from the given cancellable.
 * @returns The promise and a handle to cancel it
 */
export const runCancellable = <T>(
  run: (cancellable: Gio.Cancellable) => Promise<T>,
): [Promise<CancellableResult<T>>, Gio.Cancellable] => {
  const cancellable = Gio.Cancellable.new();
  const promise: Promise<CancellableResult<T>> = run(cancellable)
    .then(
      (value): CancellableResult<T> =>
        cancellable.is_cancelled()
          ? { result: "cancelled" }
          : { result: "completed", value },
    )
    .catch((error: unknown): CancellableResult<T> => {
      if (isGioErrorCancelled(error) || cancellable.is_cancelled()) {
        // If the error represents a cancelled operation, or if we hit another
        // error while the operation was already cancelled, just swallow the
        // error and return a cancelled result, under the assumption, that the
        // caller is never interested in errors of cancelled operations.
        return { result: "cancelled" };
      } else {
        throw error;
      }
    });
  return [promise, cancellable];
};

/**
 * Denotes an IO error.
 *
 * Use this error to wrap GIO errors which do not have a more specific context.
 */
export class IOError extends Error {}
