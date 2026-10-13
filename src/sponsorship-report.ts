import type { Measurement } from "./sponsorships";
export interface SponsorshipReport {
  campaign_id: string;
  campaign_name: string;
  sponsor: string;
  starts_at: string;
  ends_at: string;
  status: string;
  generated_at: string;
  editorial_independence: string;
  reporting_note: string;
  placements: Array<{
    application_id: string;
    publication_id: string;
    publication: string;
    publication_url: string;
    placement_id: string;
    placement: string;
    product_path: string;
    communities: string[];
    delivery_status: string;
    views: Measurement;
    clicks: Measurement;
    newsletter_deliveries: Measurement;
  }>;
}
const escape = (text: unknown) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const date = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " UTC";
function metric(value: Measurement): string {
  if (value.status === "unavailable" || value.value === null)
    return "Unavailable";
  return `${escape(value.value.toLocaleString("en-US"))} <small>${escape(value.status)}</small>${value.from && value.to ? `<small>Observed period:<br>${escape(date(value.from))}<br>to ${escape(date(value.to))}</small>` : ""}`;
}
/** Shared by the newsroom print/export view and the repeatable PDF renderer. */
export function campaignReportHtml(report: SponsorshipReport): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(report.campaign_name)} | Sponsorship report</title><style>
  @page{size:Letter;margin:18mm}*{box-sizing:border-box}body{font:11pt/1.5 Arial,sans-serif;color:#172d37;margin:0}h1,h2{font-family:Georgia,serif;font-weight:normal}h1{font-size:30pt;line-height:1.12;margin:16pt 0}h2{font-size:19pt;margin:0 0 8pt}header{border-bottom:2pt solid #173d32;padding-bottom:16pt}.brand{font-size:10pt;letter-spacing:1pt}p{margin:8pt 0}.meta{color:#4e5d64;font-size:10pt}section{break-inside:avoid;margin:24pt 0}table{width:100%;border-collapse:collapse;margin:12pt 0}td,th{text-align:left;border-bottom:1px solid #d8dedc;padding:8pt 5pt}th{font-size:9pt}small{display:block;color:#4e5d64;font-size:8pt}footer{border-top:1px solid #d8dedc;padding-top:12pt;font-size:9pt}.notes{font-size:9pt;color:#4e5d64}
  </style></head><body><header><div class="brand">BAY AREA NEWS NETWORK</div><p>Community sponsorship report</p><h1>${escape(report.campaign_name)}</h1><p>${escape(report.sponsor)}</p><p class="meta">Campaign period: ${escape(date(report.starts_at))} to ${escape(date(report.ends_at))}<br>Status: ${escape(report.status)}<br>Prepared: ${escape(date(report.generated_at))}</p></header>
  ${report.placements.map((p) => `<section><h2>${escape(p.publication)}</h2><p>${escape(p.placement)} · ${escape(p.product_path)}</p><p class="meta">Community scope: ${escape(p.communities.length ? p.communities.join(", ") : "Publication-wide")}<br>Placement delivery: ${escape(p.delivery_status)}</p><table><thead><tr><th>Observed placement views</th><th>Observed sponsor link clicks</th><th>Newsletter deliveries</th></tr></thead><tbody><tr><td>${metric(p.views)}</td><td>${metric(p.clicks)}</td><td>${metric(p.newsletter_deliveries)}</td></tr></tbody></table><p class="notes">Views: ${escape(p.views.methodology)}<br>Clicks: ${escape(p.clicks.methodology)}<br>Newsletter: ${escape(p.newsletter_deliveries.methodology)}</p></section>`).join("")}
  <footer><p>${escape(report.reporting_note)}</p><p>${escape(report.editorial_independence)}</p><p>Campaign reference: ${escape(report.campaign_id)}</p></footer></body></html>`;
}
