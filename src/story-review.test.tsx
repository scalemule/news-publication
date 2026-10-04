// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StoryReview } from "./story-review";

const document = {
  title: "A private family announcement",
  subtitle: "An occasion to celebrate",
  content_markdown: "Family and friends will gather.",
  section: "Celebrations",
  community: "Local",
  media: [],
};
const initial = {
  publication: { name: "Test publication" },
  reviewer: "Family",
  celebration_type: "weddings",
  revision: {
    id: "exact-revision",
    number: 1,
    document,
    content_html: "<p>Family and friends will gather.</p>",
  },
  history: [],
  permissions: [
    "VIEW_DRAFT",
    "APPROVE",
    "COMMENT",
    "PROPOSE_EDITS",
    "REQUEST_CHANGES",
    "ANSWER_QUESTIONS",
    "UPLOAD_MEDIA",
    "DECLINE",
  ],
  questions: Array.from({ length: 7 }, (_, i) => ({
    id: `q${i}`,
    prompt: `Optional question ${i + 1}`,
    required: false,
  })),
  contributions: [],
  review_policy: "SUBJECT_APPROVAL_PLUS_EDITOR",
  published: false,
  decision: null as string | null,
};
const photo = { kind: "image" as const, contribution_id: "original-photo", file_id: "private-file", caption: "A family photograph", credit: "", alt: "The couple smiling", position: "hero" };
function setup(policy = initial.review_policy, shell = false, withPhoto = false, permissions = initial.permissions, failReplacementNote = false) {
  let current = { ...initial, review_policy: policy, permissions, revision: { ...initial.revision, document: { ...document, media: withPhoto ? [photo] : [] } } };
  const drafts: Record<string, any> = {};
  const fetcher = vi.fn(async (_url: unknown, options?: RequestInit) => {
    if (typeof options?.body === "string") {
      const body = JSON.parse(options.body);
      if (body.action === "SAVE_DRAFT") {
        drafts[body.panel] = { panel: body.panel, version: (drafts[body.panel]?.version || 0) + 1, data: body.data };
        return { ok: true, json: async () => ({ data: drafts[body.panel] }) };
      }
      if (body.draft) {
        const d = body.draft;
        drafts[d.panel] = { panel: d.panel, version: d.version + 1, data: {} };
        return { ok: true, json: async () => ({ data: { cleared_draft: drafts[d.panel] } }) };
      }
    }
    if (String(_url).endsWith("/media/private-file")) return { ok: true, blob: async () => new Blob(["photo"], { type: "image/jpeg" }) };
    if (options?.body instanceof FormData) return { ok: true, json: async () => ({ data: { id: "replacement-photo" } }) };
    if (failReplacementNote && typeof options?.body === "string" && JSON.parse(options.body).action === "COMMENT") return { ok: false, json: async () => ({ error: { message: "Try again" } }) };
    if (
      options?.method === "POST" &&
      typeof options.body === "string" &&
      JSON.parse(options.body).action === "APPROVE"
    )
      current = { ...current, decision: "APPROVED" };
    return { ok: true, json: async () => ({ success: true, data: { ...current, response_drafts: drafts } }) };
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <StoryReview
      sessionId="private-session"
      publicationName="Test publication"
      publicationHeader={shell ? <header aria-label="Publication masthead">Real publication header</header> : undefined}
      publicationFooter={shell ? <footer aria-label="Publication footer">Real publication footer</footer> : undefined}
    />,
  );
  return fetcher;
}
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  window.history.replaceState(null, "", "/");
  Element.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:private-photo");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("family review", () => {
  it("requests a replacement for the exact photo without changing or approving the current revision", async () => {
    const fetcher = setup(initial.review_policy, false, true);
    fireEvent.click(await screen.findByRole("button", { name: "Change photo" }));
    expect(screen.getByRole("heading", { name: "Change photo" })).toBeTruthy();
    expect(screen.getByText(/current photo stays in place/)).toBeTruthy();
    const upload = screen.getByRole("button", { name: "Upload privately" });
    fireEvent.change(screen.getByLabelText("Photograph or video"), { target: { files: [new File(["photo"], "replacement.jpg", { type: "image/jpeg" })] } });
    expect(upload.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(upload.closest("form")!);
    await screen.findByText(/replacement photo has been sent/);
    const posts = fetcher.mock.calls.filter(([, o]) => o?.method === "POST" && (typeof o.body !== "string" || JSON.parse(o.body).action !== "SAVE_DRAFT"));
    expect(posts).toHaveLength(2);
    expect(posts[0][0]).toBe("/api/news/review/private-session/media");
    expect(JSON.parse((posts[0][1]!.body as FormData).get("metadata") as string).rights_confirmed).toBe(true);
    expect(JSON.parse(posts[1][1]!.body as string)).toMatchObject({ action: "COMMENT", revision_id: "exact-revision", target: { kind: "PHOTO", reference: "original-photo", replacement_contribution_id: "replacement-photo" } });
    expect(screen.getByRole("img", { name: photo.alt })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Looks Good — Approve" }).hasAttribute("disabled")).toBe(false);
  });
  it("does not offer photo changes without upload permission", async () => {
    setup(initial.review_policy, false, true, initial.permissions.filter(p => p !== "UPLOAD_MEDIA"));
    await screen.findByRole("img", { name: photo.alt });
    expect(screen.queryByRole("button", { name: "Change photo" })).toBeNull();
  });
  it("reports a saved photo if its replacement note fails and clears replacement intent for Add Photos", async () => {
    setup(initial.review_policy, false, true, initial.permissions, true);
    fireEvent.click(await screen.findByRole("button", { name: "Change photo" }));
    fireEvent.change(screen.getByLabelText("Photograph or video"), { target: { files: [new File(["photo"], "new.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: "Upload privately" }).closest("form")!);
    await screen.findByText(/photo was uploaded privately, but we couldn't attach/);
    fireEvent.click(screen.getByRole("button", { name: "Add Photos" }));
    expect(screen.getByRole("heading", { name: "Contribute a photograph" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload privately" }).hasAttribute("disabled")).toBe(true);
  });
  it("places the real publication shell around the private article without a duplicate masthead", async () => {
    setup(initial.review_policy, true);
    await screen.findByRole("heading", { name: document.title });
    const main = screen.getByRole("main");
    const header = screen.getByRole("banner", { name: "Publication masthead" });
    const footer = screen.getByRole("contentinfo", { name: "Publication footer" });
    expect(main.contains(header)).toBe(false);
    expect(main.contains(footer)).toBe(false);
    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(window.document.querySelector(".sm-review-masthead")).toBeNull();
    expect(screen.getByText("Private preview · Not published")).toBeTruthy();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
  it("shows a finished story before any optional form and reveals five questions first", async () => {
    setup();
    await screen.findByRole("heading", { name: document.title });
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Tell Us More" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(5);
    expect(screen.getByText(/Completely optional/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Answer More Questions" }),
    );
    expect(screen.getAllByRole("textbox")).toHaveLength(7);
  });
  it("one click approves the exact revision, then confirms that it is still unpublished", async () => {
    const fetcher = setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Looks Good — Approve" }),
    );
    await screen.findByRole("heading", { name: "Thank you." });
    const posts = fetcher.mock.calls.filter(
      ([, options]) => options?.method === "POST",
    );
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0][1]!.body as string)).toEqual({
      revision_id: "exact-revision",
      action: "APPROVE",
      message: null,
    });
    expect(
      screen.getAllByText(/It has not been published yet/).length,
    ).toBeGreaterThan(0);
    expect(
      screen
        .getByRole("button", { name: "Thank you — Approved" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
  it("does not silently use one-click approval when the policy could auto-publish", async () => {
    const fetcher = setup("SUBJECT_APPROVAL_AUTO_PUBLISH");
    fireEvent.click(
      await screen.findByRole("button", { name: "Looks Good — Approve" }),
    );
    expect(
      screen.getByText(/configured this version to publish or schedule/),
    ).toBeTruthy();
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(0);
  });
  it("sends quick corrections as change requests without overwriting the draft", async () => {
    const fetcher = setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Suggest a Change" }),
    );
    fireEvent.change(screen.getByLabelText("What would you like to change?"), {
      target: { value: "Correct a name" },
    });
    fireEvent.change(screen.getByLabelText("What should change?"), {
      target: { value: "Please include the accent in София." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send change request" }),
    );
    await screen.findByText("Your message has been sent to the newsroom.");
    const post = fetcher.mock.calls.find(([, o]) => typeof o?.body === "string" && JSON.parse(o.body).action === "REQUEST_CHANGES");
    expect(JSON.parse(post![1]!.body as string)).toEqual({
      revision_id: "exact-revision",
      action: "REQUEST_CHANGES",
      message: "Correct a name: Please include the accent in София.",
      draft: { panel: "changes", version: 1 },
    });
  });
  it("accepts a photo without requiring descriptions but always requires permission", async () => {
    const fetcher = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Add Photos" }));
    const upload = screen.getByRole("button", { name: "Upload privately" });
    expect(upload.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Photograph or video"), {
      target: {
        files: [new File(["test"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
    expect(upload.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(upload.hasAttribute("disabled")).toBe(false);
    expect(
      screen.getByLabelText("Caption (optional)").hasAttribute("required"),
    ).toBe(false);
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(0);
  });
});
