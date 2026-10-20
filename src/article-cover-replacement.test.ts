import { describe, expect, it, vi } from "vitest";
import { PublicationArticleClient, type PublishedCoverReplacement } from "./article-workflow-client";

const input: PublishedCoverReplacement = {
  articleId: "article", expectedVersion: 7, fileId: "photo",
  caption: "Exterior of the conference center", credit: "Photographer",
  alt: "Входът на сградата 李 🙂", rightsConfirmed: true, aiGenerated: false, label: null,
};
function setup(change: { hero?: object; social?: object; current?: object; writeStatus?: number; socialReadyAfterTransform?: boolean } = {}) {
  const calls: { path: string; query: string; method: string; body?: any }[] = [];
  let prepared = false;
  const transport = vi.fn(async (raw: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(raw));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path: url.pathname, query: url.search, method: init?.method ?? "GET", body });
    expect(init?.redirect).toBe(url.pathname.endsWith("/transform") ? "manual" : "error");
    let data: any;
    let status = 200;
    if (url.pathname.endsWith("/processing")) data = { publication_status: "published", version: 7, ...change.current };
    else if (url.searchParams.has("preset")) data = {
      file_id: "file", photo_id: "photo", ready: true,
      variant_metadata: {
        "800": { url: "https://cdn.example.test/real-small.webp", width: 800, height: 461, format: "webp" },
        "1600": { url: "https://cdn.example.test/real-large.webp", width: 1600, height: 923, format: "webp" },
      }, ...change.hero,
    };
    else if (url.searchParams.has("rendition")) data = {
      file_id: "file", photo_id: "photo", ready: true,
      url: "https://cdn.example.test/real-share.jpeg", width: 1198, height: 629, ...change.social, ...(prepared ? { ready: true } : {}),
    };
    else if (url.pathname.endsWith("/transform")) {
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      expect(new Headers(init?.headers).has("x-api-key")).toBe(false);
      prepared = change.socialReadyAfterTransform ?? false;
      return new Response(null, { status: 307, headers: { location: "https://cdn.example.test/real-share.jpeg" } });
    } else {
      expect(url.pathname).toBe("/v1/blog/publications/paper/articles/article/media");
      status = change.writeStatus ?? 200;
      data = { post_id: "article", version: 8 };
    }
    return new Response(JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: { message: "Article changed; reload" } }), { status });
  });
  const client = new PublicationArticleClient({ apiUrl: "https://api.example.test", publicationId: "paper", fetch: transport as typeof fetch });
  return { client, calls };
}

describe("an existing publication cover is one bounded operation", () => {
  it("uses only measured public renditions and the exact version, with no publish, upload or narration", async () => {
    const { client, calls } = setup();
    expect((await client.replacePublishedCover(input)).version).toBe(8);
    expect(calls).toHaveLength(4);
    const writes = calls.filter(c => c.method !== "GET");
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toMatchObject({
      expected_version: 7,
      cover_image_url: "https://cdn.example.test/real-large.webp",
      cover_image: { file_id: "file", width: 1600, height: 923, alt: input.alt, attribution: input.credit, caption: input.caption, ai_generated: false, label: null },
      open_graph_image: { file_id: "file", url: "https://cdn.example.test/real-share.jpeg", width: 1198, height: 629 },
    });
    expect(writes[0].body).not.toHaveProperty("title");
    expect(writes[0].body).not.toHaveProperty("content_markdown");
    expect(calls.every(c => !/publish|narrate|register|transform|enable/.test(c.path))).toBe(true);
  });
  it.each([
    { hero: { ready: false } },
    { hero: { variant_metadata: {} } },
    { hero: { file_id: "foreign", photo_id: "foreign" } },
    { social: { file_id: "other" } },
    { social: { ready: false } },
    { social: { height: undefined } },
    { social: { url: "https://cdn.example.test/private.jpeg?signature=secret" } },
    { social: { url: "http://cdn.example.test/insecure.jpeg" } },
    { current: { version: 8 } },
    { current: { publication_status: "draft" } },
  ])("keeps the current cover when readiness, identity, dimensions or version fails: %j", async change => {
    const { client, calls } = setup(change);
    await expect(client.replacePublishedCover(input)).rejects.toMatchObject({ status: 409 });
    expect(calls.every(c => c.method === "GET")).toBe(true);
  });
  it("surfaces a concurrent edit after reads without retrying or overwriting it", async () => {
    const { client, calls } = setup({ writeStatus: 409 });
    await expect(client.replacePublishedCover(input)).rejects.toMatchObject({ status: 409, message: "Article changed; reload" });
    expect(calls.filter(c => c.method === "PUT")).toHaveLength(1);
  });
  it("makes only one normal Photo transform attempt when social metadata is pending, then stops if it stays pending", async () => {
    const { client, calls } = setup({ social: { ready: false } });
    await expect(client.replacePublishedCover(input)).rejects.toMatchObject({ status: 409 });
    expect(calls.filter(c => c.path.endsWith("/transform"))).toHaveLength(1);
    expect(calls.every(c => c.method === "GET")).toBe(true);
  });
  it("attaches only the fresh measured receipt after Photo materializes the requested share rendition", async () => {
    const { client, calls } = setup({ social: { ready: false }, socialReadyAfterTransform: true });
    expect((await client.replacePublishedCover(input)).version).toBe(8);
    expect(calls.filter(c => c.path.endsWith("/transform"))).toHaveLength(1);
    const write = calls.find(c => c.method === "PUT");
    expect(write?.body.open_graph_image).toMatchObject({ width: 1198, height: 629, url: "https://cdn.example.test/real-share.jpeg" });
  });
  it.each([
    { expectedVersion: 0 }, { expectedVersion: 1.5 }, { rightsConfirmed: false },
    { alt: " " }, { aiGenerated: true, label: null }, { focalPoint: { x: 2, y: 0.5 } },
  ])("rejects incomplete editorial input before an HTTP call: %j", async change => {
    const { client, calls } = setup();
    await expect(client.replacePublishedCover({ ...input, ...change })).rejects.toBeInstanceOf(Error);
    expect(calls).toHaveLength(0);
  });
});
