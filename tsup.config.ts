import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "snapshot-file": "src/snapshot-file.ts",
    "marketplace-view": "src/marketplace-view.tsx",
    "marketplace-forms": "src/marketplace-forms.tsx",
    "meet-view": "src/meet-view.tsx",
    "meet-forms": "src/meet-forms.tsx",
    "cookie-consent-banner": "src/cookie-consent-banner.tsx",
    "cookie-settings-view": "src/cookie-settings-view.tsx",
    "theme-toggle": "src/theme-toggle.tsx",
    compliance: "src/compliance.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
  external: ["react"],
});
