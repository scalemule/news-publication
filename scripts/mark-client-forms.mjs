import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const targeted = new Set([
  "marketplace-forms.js", "marketplace-forms.cjs",
  "meet-forms.js", "meet-forms.cjs",
  "cookie-consent-banner.js", "cookie-consent-banner.cjs",
  "cookie-settings-view.js", "cookie-settings-view.cjs",
  "theme-toggle.js", "theme-toggle.cjs",
]);

for (const name of readdirSync("dist")) {
  if (!name.endsWith(".js") && !name.endsWith(".cjs")) continue;
  const file = join("dist", name);
  const source = readFileSync(file, "utf8");
  const needsClient =
    targeted.has(name) ||
    (/(useState|useEffect|useCallback|useMemo|useRef)\b/.test(source) &&
      !name.startsWith("index."));
  if (needsClient && !source.startsWith('"use client"') && !source.startsWith("'use client'")) {
    writeFileSync(file, `"use client";\n${source}`);
    console.log(`Marked client boundary: ${file}`);
  }
}
