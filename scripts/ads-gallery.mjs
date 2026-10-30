#!/usr/bin/env node
/**
 * Renders every ScaleMule Ads format in every acceptance state to one
 * self-contained HTML file for the visual review required by
 * ADR-2026-10-29 section 5. Usage: node scripts/ads-gallery.mjs <out.html>
 * Requires `npm run build` first (renders from dist/).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdUnit } from "../dist/ad-slot.js";
import { AD_FORMAT_KEYS, AD_COPY_LIMITS } from "../dist/ads.js";

const out = process.argv[2];
if (!out) {
  console.error("usage: ads-gallery.mjs <out.html>");
  process.exit(1);
}
const css = readFileSync(new URL("../ads.css", import.meta.url), "utf8");
const tokens = readFileSync(new URL("../tokens/broadsheet.css", import.meta.url), "utf8");
// Real public brand assets (scripts/gallery-assets/, fetched from napsite.com,
// mergeyard.com and plouris.com), embedded as data URIs so the file stands alone.
const asset = (name, type) =>
  `data:${type};base64,${readFileSync(new URL(`./gallery-assets/${name}`, import.meta.url)).toString("base64")}`;
const BRAND = {
  napsite: { url: asset("napsite-mark.png", "image/png"), width: 256, height: 256, alt: "NapSite" },
  mergeyard: { url: asset("mergeyard-icon.svg", "image/svg+xml"), width: 329, height: 303, alt: "MergeYard" },
  plouris: { url: asset("plouris-logo.svg", "image/svg+xml"), width: 392, height: 119, alt: "Plouris" },
  plourisIcon: { url: asset("plouris-icon.svg", "image/svg+xml"), width: 162, height: 172, alt: "Plouris" },
};

const svg = (w, h, fill, text) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/><text x="50%" y="50%" fill="#fff" font-family="Arial" font-size="${Math.round(h / 6)}" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`,
  )}`;

const advertisers = [
  // Each creative uses only its own brand's assets. NapSite has no 1:1 image asset.
  { advertiser: "NapSite", headline: "Your business deserves a better website.", description: "Designed, hosted and managed for you.", cta: "Explore NapSite", link_label: "Built on napsite.com", logo: BRAND.napsite, square: null },
  { advertiser: "MergeYard", headline: "Support that lives inside Zendesk", description: "Shared inboxes, SLAs and reporting for teams who answer customers all day.", cta: "See MergeYard", logo: BRAND.mergeyard, square: { ...BRAND.mergeyard, alt: "" } },
  { advertiser: "Plouris", headline: "A calmer inbox for busy practices.", description: "Plouris keeps every client conversation, file and task in one place.", cta: "Start free", logo: BRAND.plouris, square: { ...BRAND.plourisIcon, alt: "" } },
];
// Longest REALISTIC copy: every field at its limit, made of normal words.
const realistic = {
  advertiser: "Diablo Valley Roofing & Exterior Restoration Company",
  headline: "Local roof repairs, honest quotes and crews who show up",
  description: "Family owned since 1994. Licensed and insured. Free inspections in Pleasanton, Dublin, Livermore and San Ramon.",
  cta: "Get a free estimate",
  link_label: "Roof repairs by Diablo Valley Roofing",
  logo: null,
  square: null,
};
for (const [k, max] of Object.entries(AD_COPY_LIMITS)) {
  if (realistic[k] && [...realistic[k]].length > max) throw new Error(`realistic ${k} exceeds ${max}`);
}
// Adversarial: unbroken strings at the limit (stress only, not a real creative).
const longest = {
  advertiser: "A".repeat(AD_COPY_LIMITS.advertiser),
  headline: "Wwwwwwwwww ".repeat(6).trim().slice(0, AD_COPY_LIMITS.headline),
  description: "Mmmmmmmmmmmm ".repeat(10).trim().slice(0, AD_COPY_LIMITS.description),
  cta: "Mmmmmmmmmmmmmmmmmmmm".slice(0, AD_COPY_LIMITS.cta),
  link_label: "Wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww".slice(0, AD_COPY_LIMITS.link_label),
  logo: null,
  square: null,
};
// Neutral format placeholders (not brand assets) for the 3:2 card and the showcase screenshot.
const images = {
  inline_card: { url: svg(900, 600, "#3b6d8a", "3:2"), width: 900, height: 600, alt: "" },
  showcase: { url: svg(1280, 900, "#555", "1280×900"), width: 1280, height: 900, alt: "" },
};

const FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap";
const GALLERY_CSS = `
body{margin:0;background:#ddd;font-family:Arial,sans-serif}
.publication{background:var(--pub-paper);color:var(--pub-ink);padding:24px;--font-editorial:"Source Serif 4";--font-inter:"Inter"}
.publication.fallback{--pub-serif:Georgia,"Times New Roman",serif;--pub-sans:Arial,Helvetica,sans-serif}
h1{font:600 20px/1.2 Arial;margin:0 0 16px}h2{font:600 16px/1.2 Arial;margin:32px 0 8px;text-transform:uppercase;letter-spacing:.08em}h3{font:400 13px/1.4 Arial;margin:16px 0 8px;color:var(--pub-muted)}
.row{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
.frame{flex:none;max-width:100%;outline:1px dashed #999;outline-offset:4px}
.frame-label{font:11px/1 Arial;color:#777;margin-bottom:6px}
.page{display:grid;grid-template-columns:680px 300px;gap:40px;max-width:100%}
.article{font:1.125rem/1.6 var(--pub-serif);max-width:680px}
.article .hed{font:600 1.875rem/1.15 var(--pub-serif);margin:0 0 20px;text-transform:none;letter-spacing:0}
.article p{margin:0 0 1.2em}
.article .sm-ad{margin:1.5em 0}
.side{display:grid;gap:32px;align-content:start}
.side-box{padding:24px;border:1px solid var(--pub-rule);font:600 .875rem/1.4 var(--pub-sans)}`;

let n = 0;
function unit(format, content, placement = "gallery") {
  n += 1;
  const id = `0192f8a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
  return renderToStaticMarkup(
    React.createElement(AdUnit, {
      delivery: {
        delivery_id: id, flight_id: "f", creative_id: "c", revision: 1, format,
        label: format === "partner_footer" ? "sponsored" : "advertisement",
        href: `/go/${id}`, about: { advertiser: content.advertiser }, content,
      },
      placement,
    }),
  );
}

const widths = [320, 390, 768, 1280];
// The image for a format: the advertiser's own 1:1 asset for band/column, a
// neutral 3:2 or screenshot placeholder for inline_card/showcase, none otherwise.
const imageFor = (format, a) => (format === "band" || format === "column" ? a.square ?? null : images[format] ?? null);
const states = (format) => {
  const list = [];
  for (const a of advertisers) {
    const img = imageFor(format, a);
    if (img) list.push({ name: `${a.advertiser}, with image`, content: { ...a, image: img } });
    list.push({ name: `${a.advertiser}, without image${img ? "" : " (no 1:1 asset)"}`, content: { ...a, image: null } });
  }
  list.push({ name: "Longest realistic copy, no logo", content: { ...realistic, image: imageFor(format, realistic) } });
  list.push({ name: "Adversarial: unbroken 60-character strings, no logo", content: { ...longest, image: imageFor(format, longest) } });
  return list;
};

let body = "";
for (const theme of ["light", "dark"]) {
  body += `<section class="publication" data-theme="${theme}"><h1>${theme} theme</h1>`;
  for (const format of AD_FORMAT_KEYS) {
    body += `<h2>${format}</h2>`;
    for (const state of states(format)) {
      body += `<h3>${state.name}</h3><div class="row">`;
      for (const w of widths) {
        body += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px</div>${unit(format, state.content)}</div>`;
      }
      body += `</div>`;
    }
  }
  body += `</section>`;
}
// Real text enlargement: an iframe whose root font-size is 200%, so every rem
// in ads.css doubles (a parent font-size would not touch rem-based text).
let big = "";
for (const format of AD_FORMAT_KEYS) {
  big += `<h2>${format} · longest realistic copy</h2><div class="row" data-state="realistic">`;
  for (const w of [320, 390, 768]) big += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px · 200%</div>${unit(format, { ...realistic, image: imageFor(format, realistic) })}</div>`;
  big += `</div><h2>${format} · adversarial</h2><div class="row" data-state="adversarial">`;
  for (const w of [320, 768]) big += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px · 200%</div>${unit(format, { ...longest, image: imageFor(format, longest) })}</div>`;
  big += `</div>`;
}
const bigDoc = (inner) => `<!doctype html><html lang="en" style="font-size:200%"><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"><style>${tokens}\n${css}\n${GALLERY_CSS}</style></head><body><section class="publication" data-theme="light">${inner}</section></body></html>`;
body += `<section class="publication" data-theme="light" id="text-200"><h1>200% text size (root font-size 200%, light)</h1><iframe title="200% text size" srcdoc="${bigDoc(big).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="width:100%;height:9000px;border:0;background:#fff"></iframe></section>`;

// Font fallback: system fonts only, no web fonts loaded.
body += `<section class="publication fallback" data-theme="light" id="font-fallback"><h1>Font fallback (Georgia / Arial, no web fonts)</h1>`;
for (const format of AD_FORMAT_KEYS) {
  body += `<h2>${format}</h2><div class="row">`;
  for (const w of widths) body += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px · fallback</div>${unit(format, { ...advertisers[2], image: imageFor(format, advertisers[2]) })}</div>`;
  body += `</div>`;
}
body += `</section>`;

// Controls expanded, one dedicated section.
body += `<section class="publication" data-theme="light" id="controls-open"><h1>Disclosure panels, expanded (light)</h1><div class="row">`;
for (const format of ["band", "inline_card", "credit_line"]) {
  for (const w of [320, 768]) body += `<div class="frame" style="width:${w}px"><div class="frame-label">${format} · ${w}px · About open</div>${unit(format, { ...advertisers[1], image: null })}</div>`;
}
body += `</div><div class="row" data-open="report">`;
for (const w of [320, 768]) body += `<div class="frame" style="width:${w}px"><div class="frame-label">band · ${w}px · Report open</div>${unit("band", { ...advertisers[0], image: null })}</div>`;
body += `</div></section>`;

// Page context: an article column with an inline card and a sidebar with a column unit.
const para = (t) => `<p>${t}</p>`;
const lorem = [
  "The council voted 4–1 on Tuesday to extend the downtown parking pilot through the spring, citing a 12 percent rise in weekday foot traffic since the meters went in. Merchants on Main Street had asked for the extension in a letter last month.",
  "“We are not against paying for parking,” said one shop owner who has run a bakery on the corner for 19 years. “We are against paying for parking that nobody can find.” The new signage, she said, has helped.",
  "Staff estimate the pilot has cost the city about $84,000 so far, most of it for the kiosks and the app. Revenue has covered roughly two thirds of that, and the finance director expects the program to break even by June if usage holds.",
  "The lone dissenting vote came from the councilmember representing the north side, who argued that the pilot pushes cars into residential streets. Two residents spoke in support of that view during public comment.",
  "The city will publish monthly counts on its website, starting in December, and hold a review session in March before deciding whether to make the program permanent.",
  "Separately, the council approved a contract for the Elm Street crosswalk and heard an update on the library roof. Both items passed without discussion.",
  "The next regular meeting is scheduled for the second Tuesday of the month at 7 p.m. in the council chambers. Agendas are posted the Friday before.",
  "Readers with questions about the parking program can contact the city clerk. The Times will continue to follow the pilot as the monthly counts are released.",
];
for (const theme of ["light", "dark"]) {
  body += `<section class="publication" data-theme="${theme}"><h1>Page context (${theme}): 680px article with inline_card after paragraph 4, 300px sidebar with column</h1><div class="page"><article class="article"><h2 class="hed">Council extends parking pilot after merchants ask for more time</h2>${lorem.slice(0, 4).map(para).join("")}${unit("inline_card", { ...advertisers[1], image: images.inline_card }, "article_inline")}${lorem.slice(4).map(para).join("")}</article><aside class="side"><div class="side-box">Most read</div>${unit("column", { ...advertisers[2], image: advertisers[2].square }, "sidebar")}<div class="side-box">Newsletter</div></aside></div></section>`;
}
body += `<section class="publication" data-theme="light"><h1>Page context, phone (390px): article with inline_card</h1><div class="frame" style="width:390px"><article class="article">${lorem.slice(0, 4).map(para).join("")}${unit("inline_card", { ...advertisers[1], image: images.inline_card }, "article_inline")}${lorem.slice(4, 7).map(para).join("")}${unit("band", { ...advertisers[1], image: advertisers[1].square }, "leaderboard")}</article></div></section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ScaleMule Ads gallery</title>
<link rel="stylesheet" href="${FONTS}">
<style>${tokens}\n${css}\n${GALLERY_CSS}</style></head><body>${body}<script>document.querySelectorAll("#controls-open .row:not([data-open]) .sm-ad-about").forEach(d=>d.open=true);document.querySelectorAll("#controls-open [data-open=report] .sm-ad-report").forEach(d=>d.open=true)</script></body></html>`;
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB, ${n} units)`);
