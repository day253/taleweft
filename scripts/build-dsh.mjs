import { build } from "esbuild";
await build({
  entryPoints: ["plugins/dsh/src/index.mjs"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "plugins/dsh/dist/index.mjs",
  banner: {
    js: "import { createRequire as _createRequire } from 'node:module'; const require = _createRequire(import.meta.url);",
  },
});
console.log("Built plugins/dsh/dist/index.mjs");
