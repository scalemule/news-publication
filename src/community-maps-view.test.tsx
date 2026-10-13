// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PublicationCommunityMapPage } from "./community-maps-view";
import type { CommunityMapCollection, CommunityCityAtlasConfig } from "@scalemule/react/community-maps";

// Exercise the real capture component. Only its HTTP boundary is replaced.
const collection = {
  slug: "gardens",
  submission_policy: { version: "policy", text: "Permission", guidelines: "Guidelines" },
  areas: [{ id: "area", slug: "sofia", name: "София" }],
  config: {
    title: "Community gardens",
    submissions_open: true,
    categories: [{ key: "street", label: "Street" }],
  },
} as CommunityMapCollection;
const atlas = {
  areaSlug: "sofia",
  geographyUrl: "/city-geography.json",
} as CommunityCityAtlasConfig;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("submission page performance boundary", () => {
  it.each([undefined, atlas])("opens phone capture without loading the guide or geography (atlas: %j)", async (atlas) => {
    const fetcher = vi.fn(async (url: string) => {
      if (!url.endsWith("/submissions")) throw new Error(`Unexpected request: ${url}`);
      return { ok: true, json: async () => ({ data: { reader_key: crypto.randomUUID(), items: [], next_cursor: null } }) };
    });
    vi.stubGlobal("fetch", fetcher);
    const { container } = render(<PublicationCommunityMapPage collection={collection} mode="submit" basePath="/gardens" atlas={atlas} />);
    await screen.findByRole("button", { name: "Take photo" });
    expect(screen.getByLabelText("Street or nearest intersection")).toBeTruthy();
    expect(container.querySelector("canvas, .maplibregl-map, .smca-atlas")).toBeNull();
    expect(fetcher).toHaveBeenCalled();
    expect(fetcher.mock.calls.every(([url]) => url === "/api/community-maps/collections/gardens/submissions")).toBe(true);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });
});
