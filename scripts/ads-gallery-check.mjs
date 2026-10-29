#!/usr/bin/env node
/**
 * Measures the gallery the way the ADR section 5 review does: real text
 * enlargement at 200% (description ≥ 28px, headline ≥ 44px), control targets
 * ≥ 44px, and no horizontal overflow at 320/390/768/1280.
 * Usage: PLAYWRIGHT_ROOT=<dir with playwright installed> node scripts/ads-gallery-check.mjs <gallery.html>
 */
import { createRequire } from "node:module";
import { resolve } from "node:path";

const gallery = process.argv[2];
if (!gallery) {
  console.error("usage: ads-gallery-check.mjs <gallery.html>");
  process.exit(1);
}
const root = process.env.PLAYWRIGHT_ROOT || process.cwd();
const { chromium } = createRequire(resolve(root, "package.json"))("playwright");

const browser = await chromium.launch();
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

// Overflow and target sizes in the main document.
const report = await page.evaluate(() => {
  const out = { overflow: [], smallTargets: 0, targets: 0 };
  for (const frame of document.querySelectorAll(".frame")) {
    const unit = frame.querySelector(".sm-ad");
    if (!unit) continue;
    if (unit.scrollWidth > unit.clientWidth + 1) out.overflow.push(`${unit.dataset.adFormat} @ ${frame.style.width}`);
    for (const t of unit.querySelectorAll(".sm-ad-bar summary, .sm-ad-hide, .sm-ad-cta")) {
      const r = t.getBoundingClientRect();
      out.targets++;
      if (r.height < 44 && !unit.classList.contains("sm-ad--credit_line")) out.smallTargets++;
    }
  }
  return out;
});
console.log(`targets measured ${report.targets}, under 44px: ${report.smallTargets}; overflowing units: ${report.overflow.length}`);
if (report.overflow.length) fail("overflow: " + [...new Set(report.overflow)].slice(0, 10).join(", "));
if (report.smallTargets) fail(`${report.smallTargets} control targets under 44px`);
await browser.close();
console.log(failures ? `${failures} check(s) failed` : "all gallery checks passed");
process.exit(failures ? 1 : 0);
