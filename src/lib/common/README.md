# Common extension utilities

This library contains some common utilities for GNOME extensions in typescript.

- `ui/icons.ts` contains facilities to load icons in extensions.
- `error.ts` contains utililities for working with Javascript errors.
- `gio.ts` contains useful helpers around Gio.  In particular, it contains `runCancellable` which abstracts the details
  of handling asynchronous cancellable operations.
- `i18n.ts` contains helpers for i18n in extensions.
- `lifecycle.ts` contains an abstraction for working with destructible resources, to support cleaning up properly.
- `random.ts` contains some convenience functions for random numbers.
