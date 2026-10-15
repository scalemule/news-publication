import { describe, expect, it, vi } from "vitest";
import { createPublicationToysHandler, createToyCommunityHandler, type ToyScope } from "./toys-server";
const id = "019a1234-1234-7123-8123-123456789abc";
const scope: ToyScope = {
  apiKey: "isolated-server-test-key",
  origin: "https://toys.example.test",
  gatewayUrl: "https://api.example.test",
  collectionSlug: "toyround",
  clientContext: {},
  writesEnabled: true,
};
const request = (path = "", method = "GET", origin?: string, body: unknown = {}) =>
  new Request(scope.origin + "/api/toys/" + path, {
    method,
    headers: { ...(origin ? { origin } : {}), "content-type": "application/json", "x-app-id": "attacker", authorization: "Bearer attacker" },
    ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
describe("publication toy proxy", () => {
  it("rejects management, moderation, traversal and unknown routes without upstream access", async () => {
    const fetch = vi.fn();
    const handler = createPublicationToysHandler({ resolve: async () => scope, fetch });
    for (const path of [["manage"], [".."], [id, "commands"], ["requests", id, "evidence"], ["locations", "manage"], ["profiles", "not-a-uuid"], ["submissions", "bad", "media"], [id, "media", "x"]])
      expect((await handler(request(path.join("/")), path)).status).toBe(404);
    expect((await handler(request("", "PATCH"), [])).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires server-resolved login, launch gate and exact origin for mutation", async () => {
    const fetch = vi.fn();
    const handler = createPublicationToysHandler({ resolve: async () => scope, fetch });
    expect((await handler(request("", "POST", scope.origin), [])).status).toBe(401);
    expect((await handler(request(id + "/requests", "POST", "https://evil.example.test"), [id, "requests"])).status).toBe(403);
    const paused = createPublicationToysHandler({ resolve: async () => ({ ...scope, accessToken: "s", writesEnabled: false }), fetch });
    expect((await paused(request("", "POST", scope.origin), [])).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("forwards allowlisted reads anonymously with the publication key and only known filters", async () => {
    const fetch = vi.fn(async () => Response.json({ data: { items: [] } }));
    const handler = createPublicationToysHandler({ resolve: async () => scope, fetch });
    const response = await handler(new Request(scope.origin + "/api/toys?category=puzzles&evil=1&area_id=" + id, { headers: { "x-app-id": "attacker" } }), []);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/v1/knowledge/community-maps/collections/toyround/toys?area_id=${id}&category=puzzles`);
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(scope.apiKey);
    expect(headers["x-app-id"]).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
  });
  it("sends the reader session on member routes and surfaces precise gate codes", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "VERIFICATION_REQUIRED" } }), { status: 403 }));
    const handler = createPublicationToysHandler({ resolve: async () => ({ ...scope, accessToken: "reader-session" }), fetch });
    const response = await handler(request(id + "/requests", "POST", scope.origin, { kind: "request", idempotency_key: id }), [id, "requests"]);
    expect(response.status).toBe(403);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/toys/${id}/requests`);
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer reader-session");
  });
  it("proxies phone verification to Auth with the reader session and validates numbers", async () => {
    const fetch = vi.fn(async () => Response.json({ data: { message: "sent", expires_in_seconds: 600 } }));
    const handler = createPublicationToysHandler({ resolve: async () => ({ ...scope, accessToken: "reader-session" }), fetch });
    expect((await handler(request("phone", "POST", scope.origin, { action: "send", phone: "123" }), ["phone"])).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    const sent = await handler(request("phone", "POST", scope.origin, { action: "send", phone: "+1 (925) 555-0100" }), ["phone"]);
    expect(sent.status).toBe(200);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/v1/auth/phone/send-otp");
    expect(JSON.parse(init.body as string)).toEqual({ phone: "+19255550100", purpose: "verify_phone" });
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer reader-session");
  });
  it("remembers only server-known communities on this device", async () => {
    const fetch = vi.fn(async () => Response.json({ data: { all_areas: [{ id }] } }));
    const handler = createToyCommunityHandler({ resolve: async () => scope, fetch });
    const ok = await handler(new Request(scope.origin + "/api/toy-community", { method: "POST", headers: { origin: scope.origin }, body: JSON.stringify({ area_id: id }) }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toContain("__Host-toy-community=" + id);
    const bad = await handler(new Request(scope.origin + "/api/toy-community", { method: "POST", headers: { origin: scope.origin }, body: JSON.stringify({ area_id: "nope" }) }));
    expect(bad.status).toBe(400);
    const cross = await handler(new Request(scope.origin + "/api/toy-community", { method: "POST", headers: { origin: "https://evil.example.test" }, body: "{}" }));
    expect(cross.status).toBe(403);
  });
});
