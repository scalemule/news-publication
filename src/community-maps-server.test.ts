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
    // The reader's device position reaches the service as one JSON field with only the documented keys.
    const withPosition = new FormData();
    withPosition.append(
      "file",
      new Blob(["photo"], { type: "image/png" }),
      "photo.png",
    );
    withPosition.append("rights_confirmed", "true");
    withPosition.append("consent_version", "current-policy");
    withPosition.append(
      "device_position",
      JSON.stringify({
        latitude: 38.00112,
        longitude: -122.032162,
        accuracy_m: 12,
        read_at: "2026-10-25T01:49:11Z",
        method: "camera",
        heading: 90,
      }),
    );
    const positioned = await handler(
      new Request("https://paper.example.test/api", {
        method: "POST",
        headers,
        body: withPosition,
      }),
      [...route, "submissions", reader, "media"],
    );
    expect(positioned.status).toBe(200);
    const forwarded = calls[3].body as FormData;
    expect(JSON.parse(String(forwarded.get("device_position")))).toEqual({
      latitude: 38.00112,
      longitude: -122.032162,
      accuracy_m: 12,
      read_at: "2026-10-25T01:49:11Z",
      method: "camera",
    });
    const bad = new FormData();
    bad.append("file", new Blob(["photo"], { type: "image/png" }), "photo.png");
    bad.append("rights_confirmed", "true");
    bad.append("consent_version", "current-policy");
    bad.append("device_position", JSON.stringify({ latitude: "north" }));
    const rejected = await handler(
      new Request("https://paper.example.test/api", {
        method: "POST",
        headers,
        body: bad,
      }),
      [...route, "submissions", reader, "media"],
    );
    expect(rejected.status).toBe(400);
    expect(calls).toHaveLength(4);
    calls.length = 3;
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

describe("private contributor routes", () => {
  it("forwards only the signed reader context on history and update routes", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        data: { items: [], next_cursor: null, reader_key: "opaque" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await handler(
      new Request(
        "https://paper.example.test/api?application_id=other&actor_hash=forged",
      ),
      [...route, "submissions"],
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(String(fetch.mock.calls[0][0])).not.toContain("actor_hash");
    expect(String(fetch.mock.calls[0][0])).not.toContain("application_id");
    const id = "019a12ec-1234-7000-8000-123456789abc";
    const forbidden = await handler(
      new Request("https://paper.example.test/api", {
        method: "POST",
        headers: {
          origin: "https://attacker.test",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      [...route, "submissions", id],
    );
    expect(forbidden.status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not proxy another private route or an invalid media identifier", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const path of [
      [...route, "submissions", "bad", "media", "bad"],
      [
        ...route,
        "submissions",
        "019a12ec-1234-7000-8000-123456789abc",
        "notes",
      ],
    ]) {
      expect(
        (await handler(new Request("https://paper.example.test/api"), path))
          .status,
      ).toBe(404);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  describe("failures are visible and recoverable", () => {
    const post = (path: string[], body: BodyInit, type = "application/json") =>
      handler(
        new Request("https://paper.example.test/api", {
          method: "POST",
          headers: {
            origin: "https://paper.example.test",
            "content-type": type,
          },
          body,
        }),
        path,
      );
    it("answers a server failure with a reference, a retry hint, a log line and a durable report", async () => {
      const urls: string[] = [];
      const bodies: string[] = [];
      vi.stubGlobal("fetch", async (url: unknown, init: RequestInit) => {
        urls.push(String(url));
        bodies.push(String(init.body ?? ""));
        return String(url).endsWith("/diagnostics")
          ? Response.json({ data: { received: true } }, { status: 202 })
          : Response.json(
              { error: { code: "UNAVAILABLE", message: "db down" } },
              { status: 501 },
            );
      });
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const response = await post(
        [...route, "submissions"],
        JSON.stringify({ area_id: "a" }),
      );
      expect(response.status).toBe(501);
      const body = await response.json();
      expect(body.error.retryable).toBe(true);
      expect(body.error.reference).toMatch(/^cm_[0-9a-f]{8}$/);
      expect(body.error.message).not.toContain("db down");
      const logged = JSON.parse(String(error.mock.calls[0][0]));
      expect(logged).toMatchObject({
        event: "community_maps_proxy_error",
        route: "submit",
        status: 501,
        upstream_status: 501,
        upstream_code: "UNAVAILABLE",
        reference: body.error.reference,
      });
      await vi.waitFor(() =>
        expect(urls).toContain(
          "https://api.example.test/v1/knowledge/community-maps/collections/halloween-2026/diagnostics",
        ),
      );
      const report = JSON.parse(
        bodies[urls.findIndex((u) => u.endsWith("/diagnostics"))],
      );
      expect(report).toMatchObject({
        kind: "proxy_error",
        source: "proxy",
        stage: "submit",
        status: 501,
        reference: body.error.reference,
        host: "paper.example.test",
      });
      expect(JSON.stringify(report)).not.toContain(secret);
    });
    it("tells the reader to resend when the upload was cut off mid-transfer", async () => {
      vi.stubGlobal("fetch", vi.fn());
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const response = await post(
        [
          ...route,
          "submissions",
          "019a12ec-1234-7000-8000-123456789abc",
          "media",
        ],
        '--x\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\nPARTIAL',
        "multipart/form-data; boundary=x",
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.retryable).toBe(true);
      expect(body.error.message).toMatch(/interrupted/);
    });
    it("logs the real exception instead of hiding it", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const broken = createPublicationCommunityMapsHandler({
        resolve: async () => {
          throw new TypeError("publication context missing — Ünïcode 🎄");
        },
      });
      const response = await broken(
        new Request("https://paper.example.test/api", { method: "POST" }),
        [...route, "submissions"],
      );
      expect(response.status).toBe(503);
      expect((await response.json()).error.retryable).toBe(true);
      expect(String(error.mock.calls[0][0])).toContain(
        "TypeError: publication context missing — Ünïcode 🎄",
      );
    });
    it("forwards a browser's failure report with only known, bounded fields", async () => {
      const calls: { url: string; body: string; key: string | null }[] = [];
      vi.stubGlobal("fetch", async (url: unknown, init: RequestInit) => {
        calls.push({
          url: String(url),
          body: String(init.body),
          key: new Headers(init.headers).get("x-api-key"),
        });
        return Response.json({ data: { received: true } }, { status: 202 });
      });
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const response = await post(
        [...route, "diagnostics"],
        JSON.stringify({
          kind: "upload_failed",
          stage: "upload",
          status: 503,
          reference: "cm_1234abcd",
          attempts: 4,
          file_type: "image/jpeg",
          file_size: 1310215,
          browser: "Safari · iOS 18",
          storage: "indexeddb",
          online: true,
          contact_email: "reader@example.test",
          latitude: 37.9,
        }),
      );
      expect(response.status).toBe(202);
      expect(calls).toHaveLength(1);
      expect(calls[0].key).toBe(secret);
      const forwarded = JSON.parse(calls[0].body);
      expect(forwarded).toMatchObject({
        kind: "upload_failed",
        source: "browser",
        status: 503,
        attempts: 4,
        host: "paper.example.test",
      });
      expect(calls[0].body).not.toContain("reader@example.test");
      expect(calls[0].body).not.toContain("37.9");
      expect(
        (
          await post(
            [...route, "diagnostics"],
            JSON.stringify({ kind: "anything" }),
          )
        ).status,
      ).toBe(400);
    });
    it("refuses a failure report from another site", async () => {
      vi.stubGlobal("fetch", vi.fn());
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const response = await handler(
        new Request("https://paper.example.test/api", {
          method: "POST",
          headers: {
            origin: "https://attacker.test",
            "content-type": "application/json",
          },
          body: JSON.stringify({ kind: "upload_failed" }),
        }),
        [...route, "diagnostics"],
      );
      expect(response.status).toBe(403);
    });
    it("bounds how many reports one reader can trigger", async () => {
      const forwarded: string[] = [];
      vi.stubGlobal("fetch", async (url: unknown) => {
        forwarded.push(String(url));
        return String(url).endsWith("/diagnostics")
          ? Response.json({ data: { received: true } }, { status: 202 })
          : Response.json({ data: { id: "c", slug: "bounded-guide" } });
      });
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const guide = ["collections", "bounded-guide"];
      const first = await handler(
        new Request("https://paper.example.test/api"),
        guide,
      );
      const cookie = first.headers.get("set-cookie")!.split(";")[0];
      const report = () =>
        handler(
          new Request("https://paper.example.test/api", {
            method: "POST",
            headers: {
              origin: "https://paper.example.test",
              "content-type": "application/json",
              cookie,
            },
            body: JSON.stringify({ kind: "upload_failed", stage: "upload" }),
          }),
          [...guide, "diagnostics"],
        );
      const answers = [];
      for (let i = 0; i < 12; i++) answers.push(await (await report()).json());
      expect(answers.filter((a) => a.data.received)).toHaveLength(10);
      expect(forwarded.filter((u) => u.endsWith("/diagnostics"))).toHaveLength(
        10,
      );
    });
    it("does not forward map-viewing failures or repeat an outage report", async () => {
      const forwarded: string[] = [];
      vi.stubGlobal("fetch", async (url: unknown) => {
        forwarded.push(String(url));
        return String(url).endsWith("/diagnostics")
          ? Response.json({ data: { received: true } }, { status: 202 })
          : Response.json({ error: { message: "down" } }, { status: 501 });
      });
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const guide = ["collections", "outage-guide"];
      expect(
        (await handler(new Request("https://paper.example.test/api"), guide))
          .status,
      ).toBe(501);
      for (let i = 0; i < 3; i++)
        expect(
          (
            await post(
              [...guide, "submissions"],
              JSON.stringify({ area_id: "a" }),
            )
          ).status,
        ).toBe(501);
      await new Promise((r) => setTimeout(r, 10));
      expect(forwarded.filter((u) => u.endsWith("/diagnostics"))).toHaveLength(
        1,
      );
    });
  });
});
