// Loader hooks for the test run: the production sources import each other
// without file extensions (`import { esc } from "./kbd"`), which Node's ESM
// resolver rejects even in type-stripping mode. tsc/bundlers resolve them, so
// the tests mirror that by retrying an extensionless relative specifier with
// the usual source extensions.
//
// Registered via `node --import ./test/ts-hooks.ts --test ...` (see package.json).

import { registerHooks } from "node:module";

const EXTENSIONS = [".ts", ".mts", ".js", ".mjs", ".json"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      try {
        return nextResolve(specifier, context);
      } catch {
        for (const ext of EXTENSIONS) {
          try {
            return nextResolve(specifier + ext, context);
          } catch {
            /* try the next extension */
          }
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
