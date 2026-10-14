import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PetAccountPage, PetSubmitPage } from "./pets-plugin";
import type { PetScope } from "./pets-server";

const scope: PetScope = {
  apiKey: "isolated-test-key",
  gatewayUrl: "https://platform.example.test",
  origin: "https://paper.example.test",
  collectionSlug: "pet-community",
  accessToken: "isolated-test-session",
  clientContext: {},
};
afterEach(() => vi.unstubAllGlobals());
describe("private pet page recovery", () => {
  it("offers a retry when the identity service is unavailable, without implying a new contribution was lost", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const html = renderToStaticMarkup(
      await PetSubmitPage({ scope, signedIn: true, community: "dublin" }),
    );
    expect(html).toContain("connection is temporarily unavailable");
    expect(html).toContain('href="/pets/submit?community=dublin"');
    expect(html).toContain("Try again");
    expect(html).not.toContain("This contribution could not be loaded");
    expect(html).not.toContain("isolated-test-session");
  });
  it("offers the supported network sign-in when a reader needs to reconnect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 403 })),
    );
    const html = renderToStaticMarkup(
      await PetAccountPage({ scope, signedIn: true }),
    );
    expect(html).toContain("Reconnect your community account");
    expect(html).toContain("Continue with your network sign-in");
    expect(html).not.toContain("Try again");
  });
});
