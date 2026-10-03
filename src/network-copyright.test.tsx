import { describe, expect, it } from "vitest";
import React from "react";
import { NetworkCopyrightNotice } from "./network-copyright";
import { NETWORK_PARENT } from "./network";

describe("NetworkCopyrightNotice", () => {
  it("renders default copyright notice pointing to Bay Area News Network", () => {
    const el = NetworkCopyrightNotice({});
    const json = JSON.stringify(el);
    const currentYear = new Date().getFullYear().toString();

    expect(json).toContain(NETWORK_PARENT.name);
    expect(json).toContain(NETWORK_PARENT.url);
    expect(json).toContain(currentYear);
    expect(json).toContain("All rights reserved.");
  });

  it("renders member publication attribution when showPublicationNotice is enabled", () => {
    const el = NetworkCopyrightNotice({
      publicationName: "Danville Times",
      showPublicationNotice: true,
    });
    const json = JSON.stringify(el);

    expect(json).toContain("Danville Times");
    expect(json).toContain("is a member publication of the");
    expect(json).toContain(NETWORK_PARENT.name);
  });

  it("supports custom classNames and disabling rights reserved", () => {
    const el = NetworkCopyrightNotice({
      className: "custom-footer-copyright",
      showRightsReserved: false,
    });
    const json = JSON.stringify(el);

    expect(json).toContain("custom-footer-copyright");
    expect(json).not.toContain("All rights reserved.");
  });
});
