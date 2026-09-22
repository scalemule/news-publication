import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", "snapshot-file": "src/snapshot-file.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
});
