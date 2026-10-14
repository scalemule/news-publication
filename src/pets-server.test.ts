import { describe, expect, it, vi } from "vitest";
import {
  petAcknowledgments,
  resolvePetReferences,
  createPublicationPetsHandler,
  type PetScope,
} from "./pets-server";
import {
  createPawAuthHandler,
  pawCookie,
  sealPawFlow,
  PAW_FLOW_COOKIE,
  PAW_SIGNED_OUT_COOKIE,
} from "./pets-auth-server";
const id = "019a1234-1234-7123-8123-123456789abc";
const scope: PetScope = {
  apiKey: "isolated-server-test-key",
  origin: "https://paw.example.test",
  gatewayUrl: "https://api.example.test",
  collectionSlug: "paw",
  clientContext: {},
  writesEnabled: true,
};
const request = (path = "", method = "GET", origin?: string) =>
  new Request(scope.origin + "/api/pets/" + path, {
    method,
    headers: {
      ...(origin ? { origin } : {}),
      "content-type": "application/json",
      "x-app-id": "attacker",
      authorization: "Bearer attacker",
    },
    ...(method !== "GET" ? { body: "{}" } : {}),
  });
describe("publication pet proxy", () => {
  it("rejects management routes and path traversal without upstream access", async () => {
    const fetch = vi.fn(),
      handler = createPublicationPetsHandler({
        resolve: async () => scope,
        fetch,
      });
    for (const path of [
      ["manage"],
      [".."],
      [id, "commands"],
      ["submissions", "bad", "media"],
    ])
      expect((await handler(request(), path)).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires server-resolved login, launch gate and exact origin for mutation", async () => {
    const fetch = vi.fn();
    const handler = createPublicationPetsHandler({
      resolve: async () => scope,
      fetch,
    });
    expect((await handler(request("", "POST", scope.origin), [])).status).toBe(
      401,
    );
    const signed = createPublicationPetsHandler({
      resolve: async () => ({ ...scope, accessToken: "real-session" }),
      fetch,
    });
    expect(
      (await signed(request("", "POST", "https://attacker.example"), []))
        .status,
    ).toBe(403);
    const disabled = createPublicationPetsHandler({
      resolve: async () => ({
        ...scope,
        writesEnabled: false,
        accessToken: "real-session",
      }),
      fetch,
    });
    expect((await disabled(request("", "POST", scope.origin), [])).status).toBe(
      403,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses only server tenant context and emits private/no-store responses", async () => {
    const fetch = vi.fn(async () => Response.json({ data: { items: [] } }));
    const handler = createPublicationPetsHandler({
      resolve: async () => scope,
      fetch,
    });
    const response = await handler(request(), []);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://api.example.test/v1/knowledge/community-maps/collections/paw/pets",
    );
    expect(init.headers).toMatchObject({ "x-api-key": scope.apiKey });
    expect(init.headers).not.toHaveProperty("x-app-id");
    expect(init.headers).not.toHaveProperty("authorization");
  });
  it("does not return untrusted content as an image", async () => {
    const fetch = vi.fn(
      async () =>
        new Response("<script>bad</script>", {
          headers: { "content-type": "text/html" },
        }),
    );
    const handler = createPublicationPetsHandler({
      resolve: async () => scope,
      fetch,
    });
    const response = await handler(request(), [id, "media", id]);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("<script>");
  });
  it("does not expose raw platform errors or credentials", async () => {
    const fetch = vi.fn(
      async () => new Response("database secret", { status: 500 }),
    );
    const handler = createPublicationPetsHandler({
      resolve: async () => scope,
      fetch,
    });
    const response = await handler(request(), []);
    expect(await response.text()).not.toMatch(
      /database|secret|isolated-server/,
    );
  });
});
describe("supported network authentication", () => {
  it("stays disabled until its relying-party client is provisioned", async () => {
    const fetch = vi.fn(),
      handler = createPawAuthHandler({
        resolve: async () => scope,
        enabled: false,
        issuerOrigin: "https://identity.example.test",
        fetch,
      });
    expect(
      (await handler(request("", "POST", scope.origin), "start")).status,
    ).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects a wrong authorization origin and never exposes tokens", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        data: { state: "state", url: "https://attacker.example/authorize" },
      }),
    );
    const handler = createPawAuthHandler({
      resolve: async () => scope,
      enabled: true,
      issuerOrigin: "https://identity.example.test",
      fetch,
    });
    const response = await handler(request("", "POST", scope.origin), "start");
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("live resource and sponsorship references", () => {
  it("fetches only tenant-owned approved campaign projections for the chosen community", async () => {
    const fetch = vi.fn(
      async (url: string | URL | Request, options?: RequestInit) => {
        const u = new URL(String(url));
        expect(u.pathname).toBe(
          `/v1/blog/publications/${id}/sponsorships/delivery`,
        );
        expect(u.searchParams.get("community")).toBe("walnut-creek");
        expect(u.searchParams.get("product_path")).toBe("/pets");
        expect(options?.headers).not.toHaveProperty("authorization");
        return Response.json({ data: { items: [] } });
      },
    );
    expect(
      await petAcknowledgments(
        { ...scope, publicationId: id, accessToken: "reader-private" },
        "walnut-creek",
        "/pets",
        fetch,
      ),
    ).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("forwards only supported derivative sizes and formats to the visibility-checked route", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          headers: { "content-type": "image/webp" },
        }),
    );
    const handler = createPublicationPetsHandler({
      resolve: async () => scope,
      fetch,
    });
    const response = await handler(
      new Request(scope.origin + `/?width=640&format=webp&storage_id=private`),
      [id, "media", id],
    );
    expect(response.status).toBe(200);
    const url = String((fetch.mock.calls[0] as unknown as [string])[0]);
    expect(url).toContain("width=640&format=webp");
    expect(url).not.toContain("storage_id");
  });
  it("rejects unmatched collection references without an upstream request", async () => {
    const fetch = vi.fn();
    expect(
      await resolvePetReferences(
        scope,
        {
          pet_resources: [
            { kind: "profile", id, collection_slug: "other-tenant" },
          ],
        },
        fetch,
      ),
    ).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("native publication SSO", () => {
  const origin = scope.origin,
    state = "one-use-auth-state";
  function setup() {
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(init?.headers).toMatchObject({ "x-api-key": scope.apiKey });
        if (url.pathname.endsWith("/authorize"))
          return Response.json({
            data: {
              state,
              url:
                "https://identity.example.test/authorize?" +
                new URLSearchParams({
                  state,
                  redirect_uri: origin + "/api/news/ledvery-callback",
                  code_challenge: "challenge",
                  code_challenge_method: "S256",
                }),
            },
          });
        if (url.pathname.endsWith("/callback"))
          return Response.json({
            data: {
              session_token: "verified-reader-session",
              expires_at: new Date(Date.now() + 3600000).toISOString(),
            },
          });
        if (url.pathname.endsWith("/me"))
          return Response.json({ data: { id, email_verified: true } });
        return Response.json({ data: {} });
      },
    );
    const handler = createPawAuthHandler({
      resolve: async (req) => ({
        ...scope,
        accessToken: pawCookie(req, "__Host-existing-reader"),
      }),
      enabled: true,
      issuerOrigin: "https://identity.example.test",
      sessionCookie: "__Host-existing-reader",
      callbackPath: "/api/news/ledvery-callback",
      accountPath: "/pets/account",
      fetch,
    });
    return { handler, fetch };
  }
  it("automatically resumes at the IdP using prompt=none and the existing registered callback", async () => {
    const { handler, fetch } = setup();
    const response = await handler(
      new Request(origin + "/api/paw-auth/resume?next=/pets/submit", {
        headers: {
          "sec-fetch-site": "cross-site",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
        },
      }),
      "resume",
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toMatch(
      /^https:\/\/identity.example.test\/authorize/,
    );
    expect(
      new URL(String(fetch.mock.calls[0][0])).searchParams.get("prompt"),
    ).toBe("none");
    expect(response.headers.get("set-cookie")).toContain("__Host-paw-signin=");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("writes the publication's existing reader cookie after a bound callback", async () => {
    const { handler } = setup(),
      flow = sealPawFlow(state, "/pets/account", scope.apiKey);
    const response = await handler(
      new Request(
        origin +
          "/api/news/ledvery-callback?" +
          new URLSearchParams({ state, code: "one-use-code" }),
        { headers: { cookie: `${PAW_FLOW_COOKIE}=${flow}` } },
      ),
      "callback",
    );
    expect(response.headers.get("location")).toBe(origin + "/pets/account");
    expect(response.headers.getSetCookie()).toContainEqual(
      expect.stringContaining(
        "__Host-existing-reader=verified-reader-session; Path=/; HttpOnly; Secure; SameSite=Lax",
      ),
    );
    expect(response.headers.get("set-cookie")).not.toContain(
      "__Host-paw-reader=",
    );
    expect(await response.text()).toBe("");
  });
  it("rejects a foreign state without exchanging a code and stops unsuccessful silent-flow loops", async () => {
    const { handler, fetch } = setup(),
      flow = sealPawFlow(state, "/pets/submit", scope.apiKey);
    let response = await handler(
      new Request(
        origin + "/api/news/ledvery-callback?state=attacker&code=bad",
        { headers: { cookie: `${PAW_FLOW_COOKIE}=${flow}` } },
      ),
      "callback",
    );
    expect(response.headers.get("location")).toBe(
      origin + "/pets/account?signin=retry",
    );
    expect(fetch).not.toHaveBeenCalled();
    response = await handler(
      new Request(
        origin +
          "/api/news/ledvery-callback?" +
          new URLSearchParams({ state, error: "login_required" }),
        { headers: { cookie: `${PAW_FLOW_COOKIE}=${flow}` } },
      ),
      "callback",
    );
    expect(response.headers.get("location")).toBe(
      origin + "/pets/submit?signin=required",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("respects explicit local sign-out and requires same-origin mutation", async () => {
    const { handler, fetch } = setup();
    let response = await handler(
      new Request(origin + "/api/paw-auth/resume?next=/pets/account", {
        headers: { cookie: `${PAW_SIGNED_OUT_COOKIE}=1` },
      }),
      "resume",
    );
    expect(response.headers.get("location")).toBe(
      origin + "/pets/account?signin=required",
    );
    expect(fetch).not.toHaveBeenCalled();
    response = await handler(
      new Request(origin + "/api/paw-auth/logout", {
        method: "POST",
        headers: { origin: "https://attacker.example" },
      }),
      "logout",
    );
    expect(response.status).toBe(403);
    response = await handler(
      new Request(origin + "/api/paw-auth/logout", {
        method: "POST",
        headers: { origin, cookie: "__Host-existing-reader=session" },
      }),
      "logout",
    );
    expect(response.headers.getSetCookie()).toContainEqual(
      expect.stringContaining(`${PAW_SIGNED_OUT_COOKIE}=1`),
    );
    expect(response.headers.getSetCookie()).toContainEqual(
      expect.stringContaining("__Host-existing-reader=;"),
    );
  });
});
