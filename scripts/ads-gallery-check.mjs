#!/usr/bin/env node
/**
 * Measures the gallery the way the ADR section 5 review does: real text
 * enlargement at 200% (description ≥ 28px, headline ≥ 44px), control targets
 * ≥ 44px, and no horizontal overflow at 320/390/768/1280.
 * Also proves the brand kit survives the publication's stylesheet: in every unit
 * (including the hostile-CSS and dark-theme section and the 200% frame) the
 * computed colors of the wordmark, headline, description, eyebrow, context, CTA
 * and secondary link equal the kit written inline on the unit root.
 * Usage: PLAYWRIGHT_ROOT=<dir with playwright installed> [BROWSER=chromium|webkit] node scripts/ads-gallery-check.mjs <gallery.html>
 */
import { createRequire } from "node:module";
import { resolve } from "node:path";

const gallery = process.argv[2];
if (!gallery) {
  console.error("usage: ads-gallery-check.mjs <gallery.html>");
  process.exit(1);
}
const root = process.env.PLAYWRIGHT_ROOT || process.cwd();
const playwright = createRequire(resolve(root, "package.json"))("playwright");
const engine = process.env.BROWSER || "chromium";
if (!playwright[engine]) throw new Error(`unknown browser ${engine}`);

const browser = await playwright[engine].launch();
console.log(`browser: ${engine}`);
const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } });
await page.goto("file://" + resolve(gallery), { waitUntil: "load" });
let failures = 0;
const fail = (msg) => { failures++; console.log("FAIL " + msg); };

// 200% text size inside the iframe.
const frame = page.frames().find((f) => f !== page.mainFrame());
if (!frame) fail("no 200% iframe found");
else {
  const sizes = await frame.evaluate(() => {
    const px = (sel) => [...document.querySelectorAll(sel)].map((el) => parseFloat(getComputedStyle(el).fontSize));
    return { description: px(".sm-ad-description"), headline: px(".sm-ad-headline"), label: px(".sm-ad-label") };
  });
  const min = (a) => Math.min(...a);
  console.log(`200%: description min ${min(sizes.description)}px, headline min ${min(sizes.headline)}px, label min ${min(sizes.label)}px`);
  if (min(sizes.description) < 28) fail("description under 28px at 200%");
  if (min(sizes.headline) < 44) fail("headline under 44px at 200%");
  const heights = await frame.evaluate(() => {
    const rows = [];
    for (const frameEl of document.querySelectorAll('.row[data-state="realistic"] .frame')) {
      const unit = frameEl.querySelector(".sm-ad");
      const w = parseInt(frameEl.style.width, 10);
      if (unit && (w === 320 || w === 390)) rows.push(`${unit.dataset.adFormat}@${w}=${Math.round(unit.getBoundingClientRect().height)}px`);
    }
    return rows;
  });
  console.log("200% realistic unit heights: " + heights.join(", "));
}

// The disclosure row must never break a word: every text run in the bar is one line box.
const barCheck = () => {
  const doc = document;
  const broken = [];
  const range = doc.createRange();
  for (const el of doc.querySelectorAll(".sm-ad-bar .sm-ad-label, .sm-ad-bar summary, .sm-ad-bar .sm-ad-hide")) {
    const text = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (!text) continue;
    range.selectNodeContents(text);
    const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    if (lines > 1) broken.push(`${el.closest(".sm-ad")?.dataset.adFormat} "${text.textContent.trim()}" ${lines} lines`);
  }
  return broken;
};
const brokenMain = await page.evaluate(barCheck);
const brokenBig = frame ? await frame.evaluate(barCheck) : [];
const broken = [...brokenMain, ...brokenBig];
console.log(`bar text runs broken across lines: ${broken.length}`);
if (broken.length) fail("bar words broken: " + [...new Set(broken)].slice(0, 8).join("; "));

// Overflow and target sizes in the main document and in every 200% iframe.
// Every control in every format (credit_line included) must be at least 44px.
const measure = (tag) => {
  const out = { overflow: [], smallTargets: [], targets: 0, minHeight: null, creditMin: null };
  for (const frame of document.querySelectorAll(".frame")) {
    const unit = frame.querySelector(".sm-ad");
    if (!unit) continue;
    const label = `${unit.dataset.adFormat} @ ${frame.style.width}${tag}`;
    if (unit.scrollWidth > unit.clientWidth + 1) out.overflow.push(`${label} (client ${unit.clientWidth}, scroll ${unit.scrollWidth})`);
    // Every actual clickable thing: the creative anchor in every format, the bar
    // controls, and the controls inside OPEN panels. Collapsed panel content is
    // not clickable and is skipped; decorative CTA text is not counted as the target.
    for (const t of unit.querySelectorAll("a, button, summary, select")) {
      const details = t.closest("details");
      if (details && !details.open && t.tagName !== "SUMMARY") continue;
      const r = t.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.targets++;
      out.minHeight = Math.min(out.minHeight ?? Infinity, Math.round(r.height));
      if (unit.classList.contains("sm-ad--credit_line") && t.classList.contains("sm-ad-creative")) out.creditMin = Math.min(out.creditMin ?? Infinity, Math.round(r.height));
      if (r.height < 44 || r.width < 44) out.smallTargets.push(`${label} ${t.className || t.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  return out;
};
const reports = [await page.evaluate(measure, "")];
for (const f of page.frames()) if (f !== page.mainFrame()) reports.push(await f.evaluate(measure, " (200%)"));
const report = reports.reduce((a, b) => ({
  overflow: a.overflow.concat(b.overflow),
  smallTargets: a.smallTargets.concat(b.smallTargets),
  targets: a.targets + b.targets,
  minHeight: Math.min(a.minHeight ?? Infinity, b.minHeight ?? Infinity),
  creditMin: Math.min(a.creditMin ?? Infinity, b.creditMin ?? Infinity),
}));
console.log(`targets measured ${report.targets} (main + ${reports.length - 1} iframe), under 44px: ${report.smallTargets.length}; min target height ${report.minHeight}px (credit-line advertiser anchor min ${report.creditMin}px); overflowing units: ${report.overflow.length}`);
if (report.overflow.length) fail("overflow: " + [...new Set(report.overflow)].slice(0, 10).join(", "));
if (report.smallTargets.length) fail(`control targets under 44px: ` + [...new Set(report.smallTargets)].slice(0, 10).join(", "));
// Brand colors: every text element inside every creative must compute to the
// kit on its unit root, in the main document (light, dark, hostile) and at 200%.
const colorCheck = () => {
  const toRgb = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
  const bad = [];
  let checked = 0;
  for (const unit of document.querySelectorAll(".sm-ad:not(.sm-ad--credit_line)")) {
    const v = (name) => unit.style.getPropertyValue(name).trim();
    const fg = toRgb(v("--sm-ad-fg")), muted = toRgb(v("--sm-ad-fg-muted")), accent = toRgb(v("--sm-ad-accent"));
    const ctaBg = toRgb(v("--sm-ad-cta-bg")), ctaFg = toRgb(v("--sm-ad-cta-fg")), bg = toRgb(v("--sm-ad-bg"));
    const where = `${unit.dataset.adFormat}/${unit.dataset.adMode} in ${unit.closest("section")?.id || unit.closest("section")?.querySelector("h1")?.textContent?.slice(0, 24)}`;
    const expectations = [
      [".sm-ad-creative", "backgroundColor", bg, unit.dataset.adMode !== "photo"],
      [".sm-ad-wordmark", "color", fg, true],
      [".sm-ad-wordmark-mark", "color", accent, true],
      [".sm-ad-headline", "color", fg, true],
      [".sm-ad-description", "color", muted, true],
      [".sm-ad-eyebrow", "color", muted, true],
      [".sm-ad-context", "color", muted, true],
      [".sm-ad-advertiser", "color", muted, true],
      [".sm-ad-cta", "backgroundColor", ctaBg, true],
      [".sm-ad-cta", "color", ctaFg, true],
      [".sm-ad-strip", "backgroundColor", ctaBg, true],
      [".sm-ad-secondary", "color", fg, true],
    ];
    for (const [sel, prop, want, enabled] of expectations) {
      if (!enabled) continue;
      for (const el of unit.querySelectorAll(sel)) {
        checked++;
        const got = getComputedStyle(el)[prop];
        if (got !== want) bad.push(`${where} ${sel} ${prop} ${got} != ${want}`);
      }
    }
  }
  return { checked, bad };
};
const colors = [await page.evaluate(colorCheck)];
for (const f of page.frames()) if (f !== page.mainFrame()) colors.push(await f.evaluate(colorCheck));
const colorBad = colors.flatMap((c) => c.bad);
console.log(`brand color assertions: ${colors.reduce((n, c) => n + c.checked, 0)} checked, ${colorBad.length} wrong`);
if (colorBad.length) fail("brand colors overridden: " + [...new Set(colorBad)].slice(0, 8).join("; "));

await browser.close();
console.log(failures ? `${failures} check(s) failed` : "all gallery checks passed");
process.exit(failures ? 1 : 0);
