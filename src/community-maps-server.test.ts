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
