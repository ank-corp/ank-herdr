// `node --test tests/` on Node 22+ does not expand a directory: it runs the
// folder as a module, which package.json resolves to this file. It imports
// every *.test.js beside it so the whole suite runs either way.
import { readdirSync } from "node:fs";

const here = new URL("./", import.meta.url);
for (const name of readdirSync(here).filter((n) => n.endsWith(".test.js")).sort()) {
  await import(new URL(name, here));
}
