import { describe, expect, it, vi } from "vitest";
import { createCommunityReaderAuth } from "./community-reader-auth";
import { readerSsoCookieNames } from "./reader-sso";

const origin = "https://network.example";
function reader(appleSignIn = false) {
  return createCommunityReaderAuth({
    resolve: async () => ({ origin, apiKey: "fixture", gatewayUrl: "https://gateway.example", collectionSlug: "pets", clientContext: {} }),
    clientId: "network-reader", prefix: "__Host-toy", accountPath: "/account",
    issuerOrigin: "https://identity.example", enabled: true, appleSignIn, emailSignIn: false,
  });
}
describe("community reader adoption", () => {
  it("honors both generations of local sign-out cookies", async () => {
    const auth = reader();
    for (const cookie of ["__Host-paw-signed-out=1", readerSsoCookieNames("__Host-toy").signedOut + "=1"]) {
      const res = await auth.route(new Request(origin + "/api/paw-auth/resume?next=/give", {headers:{cookie}}), "resume");
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe(origin + "/give");
    }
  });
  it("keeps an unconfigured Apple start closed and requires a same-origin reader action", async () => {
    const auth = reader();
    const endpoint = origin + "/api/paw-auth/start?provider=apple";
    for (const [requestOrigin,status] of [[origin,404],["https://other.example",403]] as const) {
      const res = await auth.route(new Request(endpoint, {method:"POST",headers:{origin:requestOrigin,"content-type":"application/json"}}), "start");
      expect(res.status).toBe(status);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });
  it("keeps shared email off until the site's ownership flow is ready", async () => {
    const response = await reader().route(new Request(origin + "/api/paw-auth/start?provider=email",
      {method:"POST",headers:{origin,"content-type":"application/json"}}), "start");
    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("preserves an existing reader session when Auth cannot verify its status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({error:{code:"UPSTREAM_ERROR"}},{status:503})));
    try {
      const res = await reader().route(new Request(origin + "/api/paw-auth/session", {headers:{cookie:"__Host-toy-reader=existing"}}), "session");
      expect(res.status).toBe(503);
      expect(res.headers.get("set-cookie")).toBeNull();
    } finally { vi.unstubAllGlobals(); }
  });
});
