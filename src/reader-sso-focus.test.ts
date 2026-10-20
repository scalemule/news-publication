// @vitest-environment jsdom
import {afterEach, expect, it} from "vitest";
import {isFormField} from "./reader-sso-client";
afterEach(() => document.body.replaceChildren());
it("protects typing in the widget's nested shadow-root input and textarea", () => {
  for (const tag of ["input", "textarea"]) {
    const host = document.createElement("div"); document.body.append(host);
    const root = host.attachShadow({mode:"open"});
    const nested = document.createElement("div"); root.append(nested);
    const inside = nested.attachShadow({mode:"open"});
    const field = document.createElement(tag); inside.append(field); field.focus();
    expect(document.activeElement).toBe(host);
    expect(isFormField(document.activeElement)).toBe(true);
    host.remove();
  }
});
it("distinguishes shadow-root buttons from text entry and handles absent focus", () => {
  const host=document.createElement("div"); document.body.append(host);
  const root=host.attachShadow({mode:"open"}); const button=document.createElement("button"); root.append(button); button.focus();
  expect(document.activeElement).toBe(host); expect(isFormField(document.activeElement)).toBe(false); expect(isFormField(null)).toBe(false);
});
