#!/usr/bin/env node
/**
 * Renders every ScaleMule Ads format in every acceptance state to one
 * self-contained HTML file for the visual review required by
 * ADR-2026-10-29 section 5. Usage: node scripts/ads-gallery.mjs <out.html>
 * Requires `npm run build` first (renders from dist/).
 *
 * Sections: typographic (three real brand kits, with and without a 1:1 image,
 * longest realistic copy, adversarial copy), photo mode, artwork mode, 200%
 * text, font fallback, hostile publication CSS, expanded controls, page context.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdUnit } from "../dist/ad-slot.js";
import { AD_FORMAT_KEYS, AD_COPY_LIMITS, AD_ARTWORK_BOXES } from "../dist/ads.js";

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
const LOGO = {
  napsite: { url: asset("napsite-mark.png", "image/png"), width: 256, height: 256, alt: "NapSite" },
  mergeyard: { url: asset("mergeyard-icon.svg", "image/svg+xml"), width: 329, height: 303, alt: "MergeYard" },
  plouris: { url: asset("plouris-logo.svg", "image/svg+xml"), width: 392, height: 119, alt: "Plouris" },
  plourisIcon: { url: asset("plouris-icon.svg", "image/svg+xml"), width: 162, height: 172, alt: "Plouris" },
};

/** Brand kits as the service will carry them (ADR section 5, revision 9). */
const KITS = {
  napsite: {
    surface: "#173d32", ink: "#ffffff", ink_muted: "#d6e5dd", accent: "#f1d8a7", on_accent: "#173d32",
    wordmark: { text: "NapSite", mark: "." }, eyebrow: "Our website partner", context: "Lazy Tensor is built on napsite.com",
    secondary: { label: "See plans & pricing", url: "https://napsite.com/pricing" },
  },
  mergeyard: {
    surface: "#0b1d33", ink: "#ffffff", ink_muted: "#c9d3e3", accent: "#f4ecdf", on_accent: "#0b1d33",
    wordmark: { text: "MergeYard" }, eyebrow: "Customer support",
    secondary: { label: "See pricing", url: "https://mergeyard.com/pricing" },
  },
  plouris: {
    surface: "#1f1a14", ink: "#faf8f3", ink_muted: "#d9d0bd", accent: "#c9a64b", on_accent: "#1f1a14",
    wordmark: { text: "Plouris" }, eyebrow: "Client work, organised",
  },
};
// The page plan carries the secondary as a sealed /go link; the gallery mimics the sealed shape.
const sealed = (kit, id) =>
  kit.secondary ? { ...kit, secondary: { label: kit.secondary.label, href: `/go/${id}?to=${Buffer.from(kit.secondary.url).toString("base64url")}&s=gallery&direct=1` } } : kit;

const svg = (w, h, fill, text) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/><text x="50%" y="50%" fill="#fff" font-family="Arial" font-size="${Math.round(h / 6)}" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`,
  )}`;
/** A "brand photograph" placeholder: soft gradient in the brand palette with a subtle grain. */
const photo = (w, h, a, b, label) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.12"/></feComponentTransfer></filter></defs><rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" filter="url(#n)"/><circle cx="${w * 0.68}" cy="${h * 0.42}" r="${Math.min(w, h) * 0.22}" fill="${b}" opacity="0.55"/><text x="24" y="${h - 20}" fill="#fff" fill-opacity="0.7" font-family="Arial" font-size="14">brand photograph · ${label}</text></svg>`,
  )}`;
/** Finished art placeholder at an exact box. */
const art = (w, h, a, b, label) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${a}"/><path d="M0 ${h} L${w * 0.6} 0 L${w} 0 L${w} ${h} Z" fill="${b}" opacity="0.35"/><text x="24" y="${Math.min(h * 0.55, 80)}" fill="#fff" font-family="Georgia,serif" font-size="${Math.min(Math.round(h / 5), 48)}">${label}</text><text x="24" y="${h - 16}" fill="#fff" fill-opacity="0.75" font-family="Arial" font-size="12">finished artwork · ${w}×${h}</text></svg>`,
  )}`;

const advertisers = [
  // Each creative uses only its own brand's assets. NapSite has no 1:1 image asset.
  { key: "napsite", advertiser: "NapSite", headline: "Your business deserves a better website.", description: "Designed, hosted and managed for you.", cta: "Explore NapSite", link_label: "Built on napsite.com", logo: LOGO.napsite, square: null, light: "#2f6b57" },
  { key: "mergeyard", advertiser: "MergeYard", headline: "Support that lives inside Zendesk", description: "Shared inboxes, SLAs and reporting for teams who answer customers all day.", cta: "See MergeYard", logo: LOGO.mergeyard, square: { ...LOGO.mergeyard, alt: "" }, light: "#1d42a6" },
  { key: "plouris", advertiser: "Plouris", headline: "A calmer inbox for busy practices.", description: "Plouris keeps every client conversation, file and task in one place.", cta: "Start free", logo: LOGO.plouris, square: { ...LOGO.plourisIcon, alt: "" }, light: "#8d732e" },
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
const realisticKit = {
  surface: "#4a2c1a", ink: "#ffffff", ink_muted: "#e6d6c8", accent: "#f2c14e", on_accent: "#2b1a0f",
  wordmark: { text: "Diablo Valley Roofing & Exterior" }, eyebrow: "Roofing, siding and gutters since 1994",
  context: "Serving Pleasanton, Dublin, Livermore, San Ramon, Danville and the Tri-Valley",
  secondary: { label: "Read 200 customer reviews", url: "https://example.com/reviews" },
};
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
const adversarialKit = { ...realisticKit, wordmark: { text: "W".repeat(24) }, eyebrow: "E".repeat(40), context: "C".repeat(80), secondary: { label: "S".repeat(32), url: "https://example.com/" } };
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
.side-box{padding:24px;border:1px solid var(--pub-rule);font:600 .875rem/1.4 var(--pub-sans)}
/* Hostile publication rules: what a paper's own stylesheet might do to spans, links and headings. */
.hostile span,.hostile a,.hostile a span,.hostile aside span,.hostile strong{color:#171917}
.hostile a{text-decoration:underline;background:#fff0f0}`;

let n = 0;
function unit(format, content, placement = "gallery", kit = null, eager = false) {
  n += 1;
  const id = `0192f8a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
  const delivery = {
    delivery_id: id, flight_id: "f", creative_id: "c", revision: 1, format,
    label: format === "partner_footer" ? "sponsored" : "advertisement",
    href: `/go/${id}`, about: { advertiser: content.advertiser }, content,
  };
  if (kit) delivery.brand = sealed(kit, id);
  return renderToStaticMarkup(React.createElement(AdUnit, { delivery, placement, eager }));
}
const kitFor = (a) => KITS[a.key] ?? null;

const widths = [320, 390, 768, 1280];
// The image for a format: the advertiser's own 1:1 asset for band/column, a
// neutral 3:2 or screenshot placeholder for inline_card/showcase, none otherwise.
const imageFor = (format, a) => (format === "band" || format === "column" ? a.square ?? null : images[format] ?? null);
const states = (format) => {
  const list = [];
  for (const a of advertisers) {
    const img = imageFor(format, a);
    if (img) list.push({ name: `${a.advertiser}, with image`, content: { ...a, image: img }, kit: kitFor(a) });
    list.push({ name: `${a.advertiser}, without image${img ? "" : " (no 1:1 asset)"}`, content: { ...a, image: null }, kit: kitFor(a) });
  }
  list.push({ name: "No brand kit (default palette), logo tile", content: { ...advertisers[1], image: null }, kit: null });
  list.push({ name: "Longest realistic copy and kit, no logo", content: { ...realistic, image: imageFor(format, realistic) }, kit: realisticKit });
  list.push({ name: "Adversarial: unbroken strings at every limit, no logo", content: { ...longest, image: imageFor(format, longest) }, kit: adversarialKit });
  return list;
};

let body = "";
for (const theme of ["light", "dark"]) {
  body += `<section class="publication" data-theme="${theme}"><h1>${theme} theme · typographic</h1>`;
  for (const format of AD_FORMAT_KEYS) {
    body += `<h2>${format}</h2>`;
    for (const state of states(format)) {
      body += `<h3>${state.name}</h3><div class="row">`;
      for (const w of widths) {
        body += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px</div>${unit(format, state.content, "gallery", state.kit)}</div>`;
      }
      body += `</div>`;
    }
  }
  body += `</section>`;
}

// Photo mode: each brand with a generated "brand photograph" in its palette.
const photoContent = (a) => {
  const kit = KITS[a.key];
  return {
    ...a, mode: "photo", logo: a.logo, description: a.description,
    image: { url: photo(900, 600, kit.surface, a.light, a.advertiser), width: 900, height: 600, alt: "" },
    image_wide: { url: photo(1200, 420, kit.surface, a.light, a.advertiser), width: 1200, height: 420, alt: "" },
    image_tall: { url: photo(300, 400, kit.surface, a.light, a.advertiser), width: 300, height: 400, alt: "" },
    focal: { x: 0.68, y: 0.42 },
  };
};
for (const theme of ["light", "dark"]) {
  body += `<section class="publication" data-theme="${theme}" id="photo-${theme}"><h1>${theme} theme · photo mode (brand photograph placeholders)</h1>`;
  for (const format of ["band", "column", "inline_card", "partner_footer"]) {
    body += `<h2>${format}</h2>`;
    for (const a of advertisers) {
      body += `<h3>${a.advertiser}, photo</h3><div class="row">`;
      for (const w of widths) body += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px</div>${unit(format, photoContent(a), "gallery", KITS[a.key])}</div>`;
      body += `</div>`;
    }
    body += `<h3>Plouris, photo, no description, no secondary</h3><div class="row">`;
    for (const w of widths) body += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px</div>${unit(format, { ...photoContent(advertisers[2]), description: "" }, "gallery", { ...KITS.plouris, secondary: null })}</div>`;
    body += `</div>`;
  }
  body += `</section>`;
}

// Artwork mode: finished art placeholders at the exact boxes, with and without the CTA strip.
const artworkContent = (a, cta) => {
  const kit = KITS[a.key];
  const box = (k, w, h) => ({ url: art(w, h, kit.surface, a.light, a.advertiser), width: w, height: h, alt: "" });
  const b = AD_ARTWORK_BOXES;
  return {
    ...a, mode: "artwork", artwork_cta: cta, image: null,
    artwork: {
      band: box("band", b.band.width, b.band.height),
      band_mobile: box("band_mobile", b.band_mobile.width, b.band_mobile.height),
      column: box("column", b.column.width, b.column.height),
      inline_card: box("inline_card", b.inline_card.width, b.inline_card.height),
      inline_card_mobile: box("inline_card_mobile", 720, 480),
      partner_footer: box("partner_footer", b.partner_footer.width, b.partner_footer.height),
      partner_footer_mobile: box("partner_footer_mobile", b.partner_footer_mobile.width, b.partner_footer_mobile.height),
    },
  };
};
for (const theme of ["light", "dark"]) {
  body += `<section class="publication" data-theme="${theme}" id="artwork-${theme}"><h1>${theme} theme · artwork mode (finished art placeholders at the exact boxes)</h1>`;
  for (const format of ["band", "column", "inline_card", "partner_footer"]) {
    body += `<h2>${format}</h2>`;
    for (const a of advertisers) {
      for (const cta of [false, true]) {
        body += `<h3>${a.advertiser}, artwork${cta ? ", CTA strip" : ""}</h3><div class="row">`;
        for (const w of widths) body += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px</div>${unit(format, artworkContent(a, cta), "gallery", KITS[a.key])}</div>`;
        body += `</div>`;
      }
    }
  }
  body += `</section>`;
}

// Real text enlargement: an iframe whose root font-size is 200%, so every rem
// in ads.css doubles (a parent font-size would not touch rem-based text).
let big = "";
for (const format of AD_FORMAT_KEYS) {
  big += `<h2>${format} · longest realistic copy</h2><div class="row" data-state="realistic">`;
  for (const w of [320, 390, 768]) big += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px · 200%</div>${unit(format, { ...realistic, image: imageFor(format, realistic) }, "gallery", realisticKit)}</div>`;
  big += `</div><h2>${format} · adversarial</h2><div class="row" data-state="adversarial">`;
  for (const w of [320, 768]) big += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px · 200%</div>${unit(format, { ...longest, image: imageFor(format, longest) }, "gallery", adversarialKit)}</div>`;
  big += `</div>`;
}
const bigDoc = (inner) => `<!doctype html><html lang="en" style="font-size:200%"><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"><style>${tokens}\n${css}\n${GALLERY_CSS}</style></head><body><section class="publication" data-theme="light">${inner}</section></body></html>`;
body += `<section class="publication" data-theme="light" id="text-200"><h1>200% text size (root font-size 200%, light)</h1><iframe title="200% text size" srcdoc="${bigDoc(big).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="width:100%;height:9000px;border:0;background:#fff"></iframe></section>`;

// Font fallback: system fonts only, no web fonts loaded.
body += `<section class="publication fallback" data-theme="light" id="font-fallback"><h1>Font fallback (Georgia / Arial, no web fonts)</h1>`;
for (const format of AD_FORMAT_KEYS) {
  body += `<h2>${format}</h2><div class="row">`;
  for (const w of widths) body += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px · fallback</div>${unit(format, { ...advertisers[2], image: imageFor(format, advertisers[2]) }, "gallery", KITS.plouris)}</div>`;
  body += `</div>`;
}
body += `</section>`;

// Hostile publication CSS and the dark theme: the brand colors must survive both.
body += `<section class="publication hostile" data-theme="dark" id="hostile"><h1>Hostile paper rules (spans, links and headings forced to ink) on the dark theme</h1>`;
for (const format of ["band", "column", "inline_card", "partner_footer"]) {
  body += `<h2>${format}</h2><div class="row">`;
  for (const a of advertisers) body += `<div class="frame" style="width:390px"><div class="frame-label">${a.advertiser} · 390px</div>${unit(format, { ...a, image: null }, "gallery", KITS[a.key])}</div>`;
  body += `<div class="frame" style="width:390px"><div class="frame-label">MergeYard photo · 390px</div>${unit(format, photoContent(advertisers[1]), "gallery", KITS.mergeyard)}</div></div>`;
}
body += `</section>`;

// Controls expanded, one dedicated section.
body += `<section class="publication" data-theme="light" id="controls-open"><h1>Disclosure panels, expanded (light)</h1><div class="row">`;
for (const format of ["band", "inline_card", "credit_line"]) {
  for (const w of [320, 768]) body += `<div class="frame" style="width:${w}px"><div class="frame-label">${format} · ${w}px · About open</div>${unit(format, { ...advertisers[1], image: null }, "gallery", KITS.mergeyard)}</div>`;
}
body += `</div><div class="row" data-open="report">`;
for (const w of [320, 768]) body += `<div class="frame" style="width:${w}px"><div class="frame-label">band · ${w}px · Report open</div>${unit("band", { ...advertisers[0], image: null }, "gallery", KITS.napsite)}</div>`;
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
  body += `<section class="publication" data-theme="${theme}"><h1>Page context (${theme}): 680px article with inline_card after paragraph 4, 300px sidebar with column</h1><div class="page"><article class="article"><h2 class="hed">Council extends parking pilot after merchants ask for more time</h2>${lorem.slice(0, 4).map(para).join("")}${unit("inline_card", { ...advertisers[1], image: images.inline_card }, "article_inline", KITS.mergeyard)}${lorem.slice(4).map(para).join("")}</article><aside class="side"><div class="side-box">Most read</div>${unit("column", { ...advertisers[0], image: null }, "sidebar", KITS.napsite)}<div class="side-box">Newsletter</div>${unit("column", photoContent(advertisers[2]), "sidebar", KITS.plouris)}</aside></div></section>`;
}
body += `<section class="publication" data-theme="light"><h1>Page context, phone (390px): article with inline_card</h1><div class="frame" style="width:390px"><article class="article">${lorem.slice(0, 4).map(para).join("")}${unit("inline_card", { ...advertisers[1], image: images.inline_card }, "article_inline", KITS.mergeyard)}${lorem.slice(4, 7).map(para).join("")}${unit("band", { ...advertisers[0], image: null }, "leaderboard", KITS.napsite)}</article></div></section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ScaleMule Ads gallery</title>
<link rel="stylesheet" href="${FONTS}">
<style>${tokens}\n${css}\n${GALLERY_CSS}</style></head><body>${body}<script>document.querySelectorAll("#controls-open .row:not([data-open]) .sm-ad-about").forEach(d=>d.open=true);document.querySelectorAll("#controls-open [data-open=report] .sm-ad-report").forEach(d=>d.open=true)</script></body></html>`;
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB, ${n} units)`);
