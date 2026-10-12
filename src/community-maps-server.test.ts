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
    expect(new Headers(calls[2].headers).has("content-type")).toBe(false);
    expect(await uploaded.text()).not.toContain(secret);
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
