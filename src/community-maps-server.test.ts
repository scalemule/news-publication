import { afterEach, describe, it, expect, vi } from "vitest";
import { createPublicationCommunityMapsHandler } from "./community-maps-server";
import { communityMapEmbeds } from "./community-maps";
const secret = "server-api-key-never-public";
const options = {
  resolve: async () => ({
    apiKey: secret,
    gatewayUrl: "https://api.example.test",
    origin: "https://paper.example.test",
    clientContext: { ip: "192.0.2.1" },
  }),
};
const handler = createPublicationCommunityMapsHandler(options);
const route = ["collections", "halloween-2026"];
afterEach(() => vi.unstubAllGlobals());
describe("publication Community Maps boundary", () => {
  it("rejects editorial and arbitrary paths before resolving credentials", async () => {
    const resolve = vi.fn(options.resolve);
    const handle = createPublicationCommunityMapsHandler({ resolve });
    for (const path of [
      ["manage", "collections"],
      [...route, "submissions", "private"],
      ["collections", "../manage"],
    ])
      expect(
        (await handle(new Request("https://paper.example.test/api"), path))
          .status,
      ).toBe(404);
    expect(resolve).not.toHaveBeenCalled();
  });
  it("rejects cross-origin submissions before contacting the platform", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await handler(
      new Request("https://paper.example.test/api", {
        method: "POST",
        headers: { origin: "https://attacker.test" },
      }),
      [...route, "submissions"],
    );
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("signs a secure reader cookie behind a TLS proxy, ignores tenant spoofing, and never returns the key", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ data: { id: "collection", slug: "halloween-2026" } }),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await handler(
      new Request("http://internal:3000/api?application_id=other", {
        headers: { cookie: "sm_community_reader=forged" },
      }),
      route,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "HttpOnly; SameSite=Lax",
    );
    expect(response.headers.get("set-cookie")).toContain("Secure");
    const text = await response.text();
    expect(text).not.toContain(secret);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(String(fetch.mock.calls[0][0])).not.toContain("application_id");
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const next = await handler(
      new Request("https://paper.example.test/api", { headers: { cookie } }),
      route,
    );
    expect(next.headers.get("set-cookie")).toBeNull();
  });
  it("forwards one signed reader identity from collection to submission and multipart photo", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
      calls.push(init);
      return Response.json({
        data: { id: "019a12ec-1234-7000-8000-123456789abc" },
      });
    });
    const initial = await handler(
      new Request("https://paper.example.test/api"),
      route,
    );
    const cookie = initial.headers.get("set-cookie")!.split(";")[0];
    const reader = cookie.split("=")[1].split(".")[0];
    const headers = { cookie, origin: "https://paper.example.test" };
    const submitted = await handler(
      new Request("https://paper.example.test/api", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          area_id: reader,
          idempotency_key: reader,
          proposal: { title: "Private contribution" },
        }),
      }),
      [...route, "submissions"],
    );
    expect(submitted.status).toBe(200);
    const body = new FormData();
    body.append(
      "file",
      new Blob(["photo"], { type: "image/png" }),
      "photo.png",
    );
    body.append("rights_confirmed", "true");
    body.append("consent_version", "current-policy");
    const uploaded = await handler(
      new Request("https://paper.example.test/api", {
        method: "POST",
        headers,
        body,
      }),
      [...route, "submissions", reader, "media"],
    );
    expect(uploaded.status).toBe(200);
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(new Headers(call.headers).get("x-anonymous-id")).toBe(reader);
      expect(new Headers(call.headers).get("x-client-ip")).toBe("192.0.2.1");
    }
    expect(calls[2].body).toBeInstanceOf(FormData);
    expect((calls[2].body as FormData).get("consent_version")).toBe(
      "current-policy",
    );
    expect(new Headers(calls[2].headers).has("content-type")).toBe(false);
    expect(await uploaded.text()).not.toContain(secret);
  });
  it("preserves video byte ranges and refuses unexpected active media types", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
      calls.push(init);
      return new Response(new Uint8Array([1, 2]), {
        status: 206,
        headers: {
          "content-type": "video/mp4",
          "content-range": "bytes 0-1/10",
          "accept-ranges": "bytes",
        },
      });
    });
    const response = await handler(
      new Request("https://paper.example.test/api", {
        headers: { range: "bytes=0-1" },
      }),
      [...route, "media", "019a12ec-1234-7000-8000-123456789abc"],
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-range")).toBe("bytes 0-1/10");
    expect(new Headers(calls[0].headers).get("range")).toBe("bytes=0-1");
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("<script>bad</script>", {
          headers: { "content-type": "text/html" },
        }),
    );
    const rejected = await handler(
      new Request("https://paper.example.test/api"),
      [...route, "media", "019a12ec-1234-7000-8000-123456789abc"],
    );
    expect(rejected.status).toBe(503);
    expect(await rejected.text()).not.toContain("<script>");
  });
  it("caps request bodies before attempting an SDK submission", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await handler(
      new Request("https://paper.example.test/api", {
        method: "POST",
        headers: {
          origin: "https://paper.example.test",
          "content-type": "application/json",
        },
        body: "x".repeat(65537),
      }),
      [...route, "submissions"],
    );
    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses only valid live references from story metadata", () => {
    expect(
      communityMapEmbeds({
        community_maps: [
          { collection_slug: "../private", mode: "map" },
          {
            collection_slug: "public-art",
            mode: "map",
            private_address: "secret",
          },
        ],
      }),
    ).toEqual([
      {
        collection_slug: "public-art",
        mode: "map",
        feature_ids: undefined,
        area_id: undefined,
      },
    ]);
  });
});

describe("publication engagement proxy", () => {
  const feature = "019f3fe1-107b-7000-8000-111111111111";
  it("forwards reader session votes and excludes caller-supplied application scope", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        data: {
          value: -1,
          score: -1,
          up_count: 0,
          down_count: 1,
          can_vote: true,
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const handle = createPublicationCommunityMapsHandler({
      resolve: async () => ({
        ...(await options.resolve()),
        accessToken: "reader-session",
      }),
    });
    const r = await handle(
      new Request("https://paper.example.test/api?application_id=other", {
        method: "POST",
        headers: {
          origin: "https://paper.example.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ value: -1, application_id: "other" }),
      }),
      [...route, "features", feature, "vote"],
    );
    expect(r.status).toBe(200);
    expect(
      new Headers(fetch.mock.calls[0][1].headers).get("authorization"),
    ).toBe("Bearer reader-session");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ value: -1 });
    expect(String(fetch.mock.calls[0][0])).not.toContain("application_id");
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("bounds comment pagination, strips editorial query flags, and rejects invalid feature scope", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ data: { items: [], next_page: null } }),
    );
    vi.stubGlobal("fetch", fetch);
    const r = await handler(
      new Request(
        `https://paper.example.test/api?feature_id=${feature}&page=2&include_unapproved=true&status=pending`,
      ),
      [...route, "comments"],
    );
    expect(r.status).toBe(200);
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.searchParams.get("feature_id")).toBe(feature);
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.has("include_unapproved")).toBe(false);
    expect(url.searchParams.has("status")).toBe(false);
    expect(
      (
        await handler(
          new Request("https://paper.example.test/api?feature_id=invalid"),
          [...route, "comments"],
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handler(
          new Request("https://paper.example.test/api", {
            method: "POST",
            headers: { origin: "https://attacker.test" },
          }),
          [...route, "comments"],
        )
      ).status,
    ).toBe(403);
  });
});
