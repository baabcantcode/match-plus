/* eslint-disable @typescript-eslint/no-var-requires */
const { build } = require("esbuild");
const { Generator } = require("npm-dts");

const { dependencies, peerDependencies } = require("./package.json");

const entry = "src/index.ts";

new Generator({
  entry,
  platform: "node",
  output: "dist/index.d.ts",
}).generate();

const sharedConfig = {
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  minify: false,
  external: Object.keys(dependencies ?? {}).concat(Object.keys(peerDependencies ?? {})),
};

build({
  ...sharedConfig,
  target: "node12",
  outfile: "dist/index.cjs",
});

build({
  ...sharedConfig,
  outfile: "dist/index.mjs",
  format: "esm",
});