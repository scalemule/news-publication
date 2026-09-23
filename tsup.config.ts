import { defineConfig } from "tsup";

const shared = { format: ["esm", "cjs"] as ("esm" | "cjs")[], dts: true, sourcemap: false, clean: true, treeshake: true };

export default defineConfig([
  { ...shared, entry: { index: "src/index.ts", "snapshot-file": "src/snapshot-file.ts" } },
  { ...shared, clean: false, entry: { "marketplace-view": "src/marketplace-view.tsx" }, external: ["react"] },
  {
    ...shared,
    clean: false,
    entry: { "marketplace-forms": "src/marketplace-forms.tsx" },
    external: ["react"],
    banner: { js: '"use client";' },
  },
]);
