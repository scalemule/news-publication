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

describe("past-season contributor access", () => {
  it("retains the Halloween contributor history without requesting the Christmas collection or loading capture", async () => {
    const old = { ...collection, slug: "halloween-2026", config: { ...collection.config, ends_at: "2020-11-02T08:00:00Z" } };
    const fetcher = vi.fn(async (url: string) => {
      if (url !== "/api/community-maps/collections/halloween-2026/submissions") throw new Error(`Unexpected request: ${url}`);
      return { ok: true, json: async () => ({ data: { reader_key: crypto.randomUUID(), items: [], next_cursor: null } }) };
    });
    vi.stubGlobal("fetch", fetcher);
    const { container } = render(<PublicationCommunityMapPage collection={old} mode="submit" basePath="/halloween" atlas={atlas} />);
    await screen.findByText("No contributions from this browser or account in this guide.");
    expect(screen.getByRole("heading", { name: "My submissions" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Take photo" })).toBeNull();
    expect(container.querySelector('canvas, input[type="file"], form')).toBeNull();
    expect(fetcher.mock.calls.every(([url]) => url === "/api/community-maps/collections/halloween-2026/submissions")).toBe(true);
  });
});

describe("neighborhoods inside a community map", () => {
  it("passes places and the focused place through to the city guide", () => {
    // The geography request never settles, so no map engine loads.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(
      <PublicationCommunityMapPage
        collection={collection}
        mode="map"
        areaId="area"
        basePath="/holiday-lights"
        atlas={{
          ...atlas,
          places: [
            { id: "lozenets", name: "Лозенец", coordinates: [23.32, 42.67] },
            { id: "center", name: "Център 🎄", coordinates: [23.32, 42.69] },
          ],
          focusPlace: "center",
        }}
      />,
    );
    const row = screen.getByRole("navigation", { name: "Neighborhoods in София" });
    const buttons = Array.from(row.querySelectorAll("button"));
    expect(buttons.map((b) => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([
      ["Лозенец", "false"],
      ["Център 🎄", "true"],
    ]);
  });
  it("shows no neighborhood row without places", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { container } = render(<PublicationCommunityMapPage collection={collection} mode="map" areaId="area" basePath="/holiday-lights" atlas={atlas} />);
    expect(container.querySelector(".smca-places")).toBeNull();
  });
});
