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

const svg = (w, h, fill, text) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/><text x="50%" y="50%" fill="#fff" font-family="Arial" font-size="${Math.round(h / 6)}" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`,
  )}`;

const advertisers = [
  { advertiser: "NapSite", headline: "Your business deserves a better website.", description: "Designed, hosted and managed for you.", cta: "Explore NapSite", link_label: "Built on napsite.com", logo: { url: svg(128, 128, "#173d32", "N"), width: 128, height: 128 } },
  { advertiser: "MergeYard", headline: "Support that lives inside Zendesk", description: "Shared inboxes, SLAs and reporting for teams who answer customers all day.", cta: "See MergeYard", logo: { url: svg(400, 100, "#1b3a6b", "MergeYard"), width: 400, height: 100 } },
  { advertiser: "Plouris", headline: "A calmer inbox for busy practices.", description: "Plouris keeps every client conversation, file and task in one place.", cta: "Start free", logo: { url: svg(128, 128, "#6b2d5c", "P"), width: 128, height: 128 } },
];
const longest = {
  advertiser: "A".repeat(AD_COPY_LIMITS.advertiser),
  headline: "Wwwwwwwwww ".repeat(6).trim().slice(0, AD_COPY_LIMITS.headline),
  description: "Mmmmmmmmmmmm ".repeat(10).trim().slice(0, AD_COPY_LIMITS.description),
  cta: "Mmmmmmmmmmmmmmmmmmmm".slice(0, AD_COPY_LIMITS.cta),
  link_label: "Wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww".slice(0, AD_COPY_LIMITS.link_label),
  logo: null,
};
const images = {
  band: { url: svg(600, 600, "#8a6d3b", "1:1"), width: 600, height: 600, alt: "" },
  column: { url: svg(600, 600, "#8a6d3b", "1:1"), width: 600, height: 600, alt: "" },
  inline_card: { url: svg(900, 600, "#3b6d8a", "3:2"), width: 900, height: 600, alt: "" },
  showcase: { url: svg(1280, 900, "#555", "1280×900"), width: 1280, height: 900, alt: "" },
};

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
const states = (format) => {
  const list = [];
  for (const a of advertisers) {
    list.push({ name: `${a.advertiser}, with image`, content: { ...a, image: images[format] ?? null } });
    list.push({ name: `${a.advertiser}, without image`, content: { ...a, image: null } });
  }
  list.push({ name: "Longest copy, no logo, no image", content: { ...longest, image: images[format] ?? null } });
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
body += `<section class="publication" data-theme="light" style="font-size:200%"><h1>200% text size (light)</h1>`;
for (const format of AD_FORMAT_KEYS) {
  body += `<h2>${format}</h2><div class="row">`;
  for (const w of [320, 768]) body += `<div class="frame" style="width:${w}px"><div class="frame-label">${w}px</div>${unit(format, { ...longest, image: images[format] ?? null })}</div>`;
  body += `</div>`;
}
body += `</section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ScaleMule Ads gallery</title>
<style>${tokens}\n${css}
body{margin:0;background:#ddd;font-family:Arial,sans-serif}
.publication{background:var(--pub-paper);color:var(--pub-ink);padding:24px}
h1{font:600 20px/1.2 Arial;margin:0 0 16px}h2{font:600 16px/1.2 Arial;margin:32px 0 8px;text-transform:uppercase;letter-spacing:.08em}h3{font:400 13px/1.4 Arial;margin:16px 0 8px;color:var(--pub-muted)}
.row{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
.frame{flex:none;outline:1px dashed #999;outline-offset:4px}
.frame-label{font:11px/1 Arial;color:#777;margin-bottom:6px}
.sm-ad details{open:true}
</style></head><body>${body}<script>document.querySelectorAll(".sm-ad details").forEach(d=>d.open=true)</script></body></html>`;
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB, ${n} units)`);
