import { readFileSync, writeFileSync } from "node:fs";

for (const file of [
  "dist/marketplace-forms.js", "dist/marketplace-forms.cjs",
  "dist/meet-forms.js", "dist/meet-forms.cjs",
  "dist/cookie-consent-banner.js", "dist/cookie-consent-banner.cjs",
  "dist/cookie-settings-view.js", "dist/cookie-settings-view.cjs",
]) {
  const source = readFileSync(file, "utf8");
  if (!source.startsWith('"use client"')) writeFileSync(file, `"use client";\n${source}`);
}
