import {describe,it,expect} from "vitest";
import {articlePhotoHtmlMatches} from "./article-photo-verification";
const lead="https://cdn.example.test/measured-lead.webp", social="https://cdn.example.test/measured-social.jpg";
describe("actual public article photo verification",()=>{
  it("requires the rendered image and proper sharing metadata",()=>{
    expect(articlePhotoHtmlMatches(`<img src="${lead}" alt="София 李 🙂"><meta content='${social}' property='og:image'>`,lead,social)).toBe(true);
    expect(articlePhotoHtmlMatches(`<img srcset="/_next/image?url=${encodeURIComponent(lead)}&w=1440&q=75"><meta name="og:image" content="${social}">`,lead,social)).toBe(true);
  });
  it("does not certify an old visible image when new URLs appear only in serialized data",()=>{
    expect(articlePhotoHtmlMatches(`<img src="https://cdn.example.test/old.jpg"><script>{"lead":"${lead}","og":"${social}"}</script>`,lead,social)).toBe(false);
  });
  it("does not certify broken or stale share metadata",()=>{
    expect(articlePhotoHtmlMatches(`<img src="${lead}"><meta property="twitter:image" content="${social}">`,lead,social)).toBe(false);
    expect(articlePhotoHtmlMatches(`<img src="${lead}"><meta property="og:image" content="https://cdn.example.test/old.jpg">`,lead,social)).toBe(false);
  });
});
