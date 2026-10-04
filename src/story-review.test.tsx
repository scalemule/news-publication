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
function setup(policy = initial.review_policy) {
  let current = { ...initial, review_policy: policy };
  const fetcher = vi.fn(async (_url: unknown, options?: RequestInit) => {
    if (
      options?.method === "POST" &&
      typeof options.body === "string" &&
      JSON.parse(options.body).action === "APPROVE"
    )
      current = { ...current, decision: "APPROVED" };
    return { ok: true, json: async () => ({ success: true, data: current }) };
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <StoryReview
      sessionId="private-session"
      publicationName="Test publication"
    />,
  );
  return fetcher;
}
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("family review", () => {
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
    await waitFor(() =>
      expect(fetcher.mock.calls.some(([, o]) => o?.method === "POST")).toBe(
        true,
      ),
    );
    const post = fetcher.mock.calls.find(([, o]) => o?.method === "POST");
    expect(JSON.parse(post![1]!.body as string)).toEqual({
      revision_id: "exact-revision",
      action: "REQUEST_CHANGES",
      message: "Correct a name: Please include the accent in София.",
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
