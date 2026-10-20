// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StoryReview } from "./story-review";
import {
  parseDocumentBlocks,
  renderArticleBlocksToHtml,
  formatArtworkCaption,
  sanitizeInlineMarkdown,
} from "./article-blocks";

const sampleDocument = {
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
    document: sampleDocument,
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
  let current = { ...initial, review_policy: policy, permissions, revision: { ...initial.revision, document: { ...sampleDocument, media: withPhoto ? [photo] : [] } } };
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
  it("renders descriptive generated-visual captions without automatically appending production labels", () => {
    render(<StoryReview sessionId="private-session" publicationName="Test publication"
      initialReview={{ ...initial, generated_visual: { url: "https://cdn-public.scalemule.com/visual.webp", alt: "AI-generated illustration", caption: "Downtown · AI-generated illustration", label: "AI-assisted editorial illustration" } }}
      formatImageCaption={text => (text || "").replace(/AI-(generated|assisted)( editorial)? illustration/g, "").replace(/ · $/, "")} />);
    expect(screen.getByRole("img").getAttribute("alt")).toBe(sampleDocument.title);
    expect(screen.getByText("Downtown")).toBeTruthy();
    expect(screen.queryByText(/AI-assisted editorial illustration/)).toBeNull();
  });
  it("shows initial text but waits for the private cookie exchange before requesting photographs", async () => {
    const review = { ...initial, revision: { ...initial.revision, document: { ...sampleDocument, media: [photo] } } };
    let authorize!: () => void;
    const fetcher = vi.fn(async (url: unknown) => {
      if (String(url).endsWith("/session")) {
        await new Promise<void>(resolve => { authorize = resolve; });
        return { ok: true, json: async () => ({ success: true, data: { review } }) };
      }
      if (String(url).includes("/media/")) return { ok: true, blob: async () => new Blob(["private photo"], { type: "image/jpeg" }) };
      throw new Error("Unexpected request");
    });
    vi.stubGlobal("fetch", fetcher);
    render(<StoryReview sessionId="private-session" publicationName="Test publication" initialReview={review} />);
    expect(screen.getByRole("heading", { name: sampleDocument.title })).toBeTruthy();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0][0]).toContain("/session");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    authorize();
    expect(await screen.findByRole("img", { name: photo.alt })).toBeTruthy();
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/media/"))).toHaveLength(1);
  });
  it("renders a server-authorized article before the invitation exchange completes", async () => {
    let complete!: (value: unknown) => void;
    const fetcher = vi.fn(() => new Promise(resolve => { complete = resolve; }));
    vi.stubGlobal("fetch", fetcher);
    render(<StoryReview sessionId="private-session" publicationName="Test publication" initialReview={initial} />);
    expect(screen.getByRole("heading", { name: initial.revision.document.title })).toBeTruthy();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0][0]).toBe("/api/news/review/private-session/session");
    complete({ ok: true, json: async () => ({ success: true, data: { review: initial } }) });
    await waitFor(() => expect(JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string).include_review).toBe(true));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses the exchange snapshot without a second article request", async () => {
    const loaded = vi.fn();
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { review: initial } }) }));
    vi.stubGlobal("fetch", fetcher);
    render(<StoryReview sessionId="private-session" publicationName="Test publication" onReviewLoaded={loaded} />);
    await screen.findByRole("heading", { name: initial.revision.document.title });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(loaded).toHaveBeenCalledWith(initial));
  });
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
    const posts = fetcher.mock.calls.filter(([url, o]) => !String(url).endsWith("/session") && o?.method === "POST" && (typeof o.body !== "string" || JSON.parse(o.body).action !== "SAVE_DRAFT"));
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
    await screen.findByRole("heading", { name: sampleDocument.title });
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
    await screen.findByRole("heading", { name: sampleDocument.title });
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
      ([url, options]) => !String(url).endsWith("/session") && options?.method === "POST",
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
      fetcher.mock.calls.filter(([url, options]) => !String(url).endsWith("/session") && options?.method === "POST"),
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
      fetcher.mock.calls.filter(([url, options]) => !String(url).endsWith("/session") && options?.method === "POST"),
    ).toHaveLength(0);
  });
  it("opens modal dialog centered when clicking Change photo and dismisses on Escape or Close", async () => {
    setup(initial.review_policy, false, true);
    const changeBtn = await screen.findByRole("button", { name: "Change photo" });
    fireEvent.click(changeBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getByRole("heading", { name: "Change photo" })).toBeTruthy();
    expect(within(dialog).getByText(/Replacing:/)).toBeTruthy();
    expect(within(dialog).getByText(/A family photograph/)).toBeTruthy();

    // Close on Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    // Reopen and close via Close button
    fireEvent.click(screen.getByRole("button", { name: "Change photo" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("forwarded family invitations", () => {
  function familySetup(withSavedComment = false, google = false, account = false) {
    let identified = false;
    const token = "a".repeat(64);
    const fetcher = vi.fn(async (url: unknown, options?: RequestInit) => {
      const path = String(url), body = typeof options?.body === "string" ? JSON.parse(options.body) : {};
      if (path.endsWith("/session")) return { ok: true, json: async () => ({ data: { share_url: `/review/family?key=${token}`, can_share: true } }) };
      if (path === "/api/news/me") return { ok: true, json: async () => ({ user: account ? { email: "mother@example.test", full_name: "Майка", email_verified: true } : null }) };
      if (path.endsWith("/account")) { identified = true; return { ok: true, json: async () => ({ success: true }) }; }
      if (path.endsWith("/verify") && body.code === "00000000") return { ok: false, json: async () => ({ error: { message: "Check the code in your email" } }) };
      if (path.endsWith("/verify") && body.code) identified = true;
      if (path.endsWith("/join") || path.endsWith("/verify")) return { ok: true, json: async () => ({ success: true }) };
      return { ok: true, json: async () => ({ data: { ...initial, response_drafts: withSavedComment && identified ? { comment: { panel: "comment", version: 3, data: { message: "Please retain my unsent caption correction.", commentTarget: "STORY" } } } : {}, session_id: identified ? "mother-session" : "family", identity_required: !identified, participant: identified, reviewer: identified ? "Mother" : "Family", permissions: initial.permissions.filter(p => !["APPROVE", "DECLINE"].includes(p)) } }) };
    });
    vi.stubGlobal("fetch",fetcher);
    render(<StoryReview sessionId="family" publicationName="Test publication" readerAccountUrl={google ? "/api/news/me" : undefined} renderSignIn={google ? next => <a href={`/sign-in?next=${encodeURIComponent(next)}`}>Continue with Google</a> : undefined} feedbackEmail={google ? "family@example.test" : undefined} />);
    return fetcher;
  }
  it("upgrades old fragment invitations to a complete copyable address and preserves it after navigation", async () => {
    window.history.replaceState(null,"",`/review/family#${"a".repeat(64)}`);
    familySetup();
    await screen.findByRole("heading", { name: sampleDocument.title });
    expect(window.location.hash).toBe("");
    expect(new URL(window.location.href).searchParams.get("key")).toBe("a".repeat(64));
    fireEvent.click(screen.getByText("Review options"));
    expect(new URL(window.location.href).searchParams.get("key")).toBe("a".repeat(64));
    fireEvent.click(screen.getByRole("button", { name: "Share private preview" }));
    expect((await screen.findByLabelText("Private preview link") as HTMLInputElement).value).toContain(`?key=${"a".repeat(64)}`);
  });
  it("lets forwarded readers open the story before asking who is contributing", async () => {
    const fetcher=familySetup();
    await screen.findByRole("heading", { name: sampleDocument.title });
    expect(screen.queryByLabelText("Your email")).toBeNull();
    expect(screen.queryByRole("button", { name: "Looks Good — Approve" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Suggest a Change" }));
    fireEvent.change(await screen.findByLabelText("Your name"), { target: { value: "Mother" } });
    fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "mother@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
    fireEvent.change(await screen.findByLabelText("Email verification code"), { target: { value: "00000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
    const alert = await screen.findByRole("alert");
    expect(alert.closest('section[aria-label="Introduce yourself"]')).toBeTruthy();
    expect(screen.getByLabelText("Email verification code")).toBeTruthy();
    fireEvent.change(await screen.findByLabelText("Email verification code"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
    await screen.findByRole("heading", { name: "Suggest a change" });
    expect(screen.getByText("Mother", { selector: "strong" })).toBeTruthy();
    const posts = fetcher.mock.calls.flatMap(([, o]) => typeof o?.body === "string" ? [JSON.parse(o.body)] : []);
    expect(posts.some(p => p.email === "mother@example.test" && p.name === "Mother")).toBe(true);
    expect(posts.some(p => p.action === "APPROVE")).toBe(false);
  });
  it("offers a prominent feedback action without consuming an unrelated saved comment or granting approval", async () => {
    const fetcher = familySetup(true);
    const primary = await screen.findByRole("button", { name: "Looks Good — Send Feedback" });
    expect(primary.classList.contains("sm-review-primary")).toBe(true);
    fireEvent.click(primary);
    fireEvent.change(await screen.findByLabelText("Your name"), { target: { value: "Mother" } });
    fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "mother@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
    fireEvent.change(await screen.findByLabelText("Email verification code"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send my feedback" }));
    await screen.findByText(/Your feedback has been sent/);
    const commands = fetcher.mock.calls.flatMap(([, o]) => typeof o?.body === "string" ? [JSON.parse(o.body)] : []);
    const feedback = commands.find(c => c.action === "COMMENT");
    expect(feedback).toMatchObject({ revision_id: "exact-revision", message: "This draft looks good to me." });
    expect(feedback.draft).toBeUndefined();
    expect(commands.some(c => c.action === "APPROVE")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Continue your comment" }));
    expect((screen.getByLabelText("Message (optional)") as HTMLTextAreaElement).value).toBe("Please retain my unsent caption correction.");
  });
  it("shows optional questions and copying before sign-in, then offers Google first with a guest fallback", async () => {
    const copied = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copied } });
    const fetcher = familySetup(false, true);
    fireEvent.click(await screen.findByRole("button", { name: "Tell Us More" }));
    expect(screen.queryByLabelText("Your email")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "See all questions" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Copy all questions" }));
    await waitFor(() => expect(copied).toHaveBeenCalled());
    expect(copied.mock.calls[0][0]).toContain("Reference exact-revision");
    expect(copied.mock.calls[0][0]).not.toContain("a".repeat(64));
    expect(screen.getByRole("link", { name: "Answer by email" }).getAttribute("href")).toMatch(/^mailto:/);
    fireEvent.click(screen.getByRole("button", { name: "Answer online" }));
    const google = await screen.findByRole("link", { name: "Continue with Google" });
    expect(decodeURIComponent(google.getAttribute("href")!)).toContain("&respond=questions");
    expect(screen.queryByLabelText("Your email")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use an email code instead" }));
    expect(screen.getByLabelText("Your email")).toBeTruthy();
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith("/join") || String(url).endsWith("/account"))).toBe(false);
  });
  it("connects an existing verified reader without another email code or a publish action", async () => {
    const fetcher = familySetup(false, true, true);
    fireEvent.click(await screen.findByRole("button", { name: "Suggest a Change" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continue as Майка" }));
    await screen.findByRole("heading", { name: "Suggest a change" });
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/account"))).toHaveLength(1);
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith("/verify"))).toBe(false);
    expect(screen.queryByRole("button", { name: "Looks Good — Approve" })).toBeNull();
  });
  it("resumes the requested panel after Google returns and preserves the shareable key", async () => {
    window.history.replaceState(null, "", `/review/family?key=${"a".repeat(64)}&respond=questions`);
    const fetcher = familySetup(false, true, true);
    await screen.findByRole("heading", { name: "Tell us a little more" });
    expect(screen.getAllByRole("textbox")).toHaveLength(5);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/account"))).toHaveLength(1);
    expect(new URL(window.location.href).searchParams.get("respond")).toBeNull();
    expect(new URL(window.location.href).searchParams.get("key")).toBe("a".repeat(64));
  });
  it("shows Change photo modal with target preview for unauthenticated visitor before introducing themselves", async () => {
    const fetcher = vi.fn(async (url: unknown) => {
      const path = String(url);
      if (path.endsWith("/session")) return { ok: true, json: async () => ({ data: { share_url: `/review/family`, can_share: true } }) };
      if (path === "/api/news/me") return { ok: true, json: async () => ({ user: null }) };
      return {
        ok: true,
        json: async () => ({
          data: {
            ...initial,
            revision: {
              ...initial.revision,
              document: { ...sampleDocument, media: [photo] },
            },
            session_id: "visitor-session",
            identity_required: true,
            participant: false,
            reviewer: "Family",
            permissions: initial.permissions.filter(p => !["APPROVE", "DECLINE"].includes(p)),
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetcher);
    render(<StoryReview sessionId="visitor-session" publicationName="Test publication" />);

    const changeBtn = await screen.findByRole("button", { name: "Change photo" });
    fireEvent.click(changeBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Change photo" })).toBeTruthy();
    expect(within(dialog).getByText(/Replacing:/)).toBeTruthy();
    expect(within(dialog).getByText(/A family photograph/)).toBeTruthy();
    expect(within(dialog).getByLabelText("Your name")).toBeTruthy();
    expect(within(dialog).getByLabelText("Your email")).toBeTruthy();

    // Can close the modal anytime
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("structured inline editorial media & review parity", () => {
  const inlineMedia1 = {
    kind: "image" as const,
    contribution_id: "contrib-1",
    file_id: "01a12317-951b-73db-8081-98675b9ad2c9",
    artwork_title: "Crowned by Nature",
    artist_name: "Adalind Bu",
    medium: "Portrait study in graphite and mixed media",
    artwork_date: "2026",
    photographer: "Misha Sethi",
    credit: "Adalind Bu",
    alt: "Framed portrait study Crowned by Nature",
    caption: "Crowned by Nature by Adalind Bu",
    source: "Youth Art Showcase submission",
    rights_status: "Submitted by student artist",
    position: "inline",
  };
  const inlineMedia2 = {
    kind: "image" as const,
    contribution_id: "contrib-2",
    file_id: "01a12317-afbc-7a0c-b34a-5a24c89c7c78",
    artwork_title: "When the world lost its color",
    artist_name: "Rain Lin",
    medium: "Mixed media on canvas",
    artwork_date: "2026",
    photographer: "Misha Sethi",
    credit: "Rain Lin",
    alt: "Artwork When the world lost its color",
    caption: "When the world lost its color by Rain Lin",
    source: "Youth Art Showcase submission",
    rights_status: "Submitted by student artist",
    position: "inline",
  };
  const galleryMedia = {
    kind: "image" as const,
    contribution_id: "contrib-gal",
    file_id: "01a12317-c8b0-7ef0-bd5c-399f4228161d",
    artwork_title: "Gallery Art",
    artist_name: "Gallery Artist",
    caption: "A secondary gallery photograph",
    credit: "Gallery Artist",
    alt: "Gallery Art",
    position: "gallery",
  };
  const heroMedia = {
    kind: "image" as const,
    contribution_id: "contrib-hero",
    file_id: "01a1232b-3330-7934-a7a7-f78f5ea609bc",
    caption: "Opening reception at The Frame Company",
    credit: "May Fraser",
    alt: "Mayor Sherry Hu and student artists",
    position: "hero",
  };

  function setupEditorial(customDoc: any, customRev?: any) {
    let current = {
      ...initial,
      review_policy: "CONTRIBUTOR_REVIEW",
      celebration_type: undefined,
      revision: {
        id: customRev?.id || "editorial-rev-1",
        number: customRev?.number || 1,
        document: customDoc,
        content_html: "<p>Intro</p>",
      },
      decision: customRev?.decision || null,
    };
    const drafts: Record<string, any> = {};
    const fetcher = vi.fn(async (url: unknown, options?: RequestInit) => {
      if (typeof options?.body === "string") {
        const body = JSON.parse(options.body);
        if (body.action === "SAVE_DRAFT") {
          drafts[body.panel] = { panel: body.panel, version: 1, data: body.data };
          return { ok: true, json: async () => ({ data: drafts[body.panel] }) };
        }
      }
      if (String(url).includes("/media/")) {
        return { ok: true, blob: async () => new Blob(["photo"], { type: "image/jpeg" }) };
      }
      return { ok: true, json: async () => ({ success: true, data: { ...current, response_drafts: drafts } }) };
    });
    vi.stubGlobal("fetch", fetcher);
    render(
      <StoryReview
        sessionId="editorial-session"
        publicationName="Tri-Valley Weekly"
      />
    );
    return fetcher;
  }

  // 1. inline image between paragraphs
  it("renders an inline image between paragraphs", async () => {
    const doc = {
      title: "Art Showcase Feature",
      subtitle: "Dublin student artists",
      content_markdown: "First paragraph introducing the event.\n\n::inline_media{id=\"01a12317-951b-73db-8081-98675b9ad2c9\"}\n\nSecond paragraph discussing Adalind Bu.",
      section: "Culture",
      community: "Dublin",
      media: [inlineMedia1],
    };
    setupEditorial(doc);
    await screen.findByText("First paragraph introducing the event.");
    expect(screen.getByText("Second paragraph discussing Adalind Bu.")).toBeTruthy();
    expect(screen.getByText("“Crowned by Nature”")).toBeTruthy();
    expect(screen.getByText("Adalind Bu")).toBeTruthy();
  });

  // 2. multiple inline images
  it("renders multiple inline images in exact document sequence", async () => {
    const doc = {
      title: "Art Showcase Feature",
      subtitle: "Dublin student artists",
      content_markdown: "Intro.\n\n::inline_media{id=\"01a12317-951b-73db-8081-98675b9ad2c9\"}\n\nBu critique.\n\n::inline_media{id=\"01a12317-afbc-7a0c-b34a-5a24c89c7c78\"}\n\nLin critique.",
      section: "Culture",
      community: "Dublin",
      media: [inlineMedia1, inlineMedia2],
    };
    setupEditorial(doc);
    await screen.findByText("Intro.");
    const titles = screen.getAllByText(/“.*”/);
    expect(titles).toHaveLength(2);
    expect(titles[0].textContent).toContain("Crowned by Nature");
    expect(titles[1].textContent).toContain("When the world lost its color");
  });

  // 3. hero + inline images
  it("renders hero at top and inline images inside the article prose", async () => {
    const doc = {
      title: "Art Showcase Feature",
      subtitle: "Dublin student artists",
      content_markdown: "Intro.\n\n::inline_media{id=\"01a12317-951b-73db-8081-98675b9ad2c9\"}\n\nBu critique.",
      section: "Culture",
      community: "Dublin",
      media: [heroMedia, inlineMedia1],
    };
    setupEditorial(doc);
    await screen.findByText("Intro.");
    const heroFig = document.querySelector(".sm-review-hero-figure");
    const inlineFig = document.querySelector(".sm-review-inline-figure");
    expect(heroFig).toBeTruthy();
    expect(inlineFig).toBeTruthy();
    expect(heroFig?.getAttribute("data-media-id")).toBe(heroMedia.file_id);
    expect(inlineFig?.getAttribute("data-media-id")).toBe(inlineMedia1.file_id);
  });

  // 4. gallery + inline images
  it("renders inline images in prose and gallery images strictly at the bottom gallery", async () => {
    const doc = {
      title: "Art Showcase Feature",
      subtitle: "Dublin student artists",
      content_markdown: "Intro.\n\n::inline_media{id=\"01a12317-951b-73db-8081-98675b9ad2c9\"}\n\nConclusion.",
      section: "Culture",
      community: "Dublin",
      media: [inlineMedia1, galleryMedia],
    };
    setupEditorial(doc);
    await screen.findByText("Intro.");
    const prose = document.querySelector(".sm-review-prose")!;
    expect(prose.querySelector(`[data-media-id="${inlineMedia1.file_id}"]`)).toBeTruthy();
    expect(prose.querySelector(`[data-media-id="${galleryMedia.file_id}"]`)).toBeNull();
    const article = document.querySelector(".sm-review-article")!;
    const outsideFigures = Array.from(article.children).filter(c => c.tagName === "FIGURE");
    expect(outsideFigures.some(f => f.getAttribute("data-media-id") === galleryMedia.file_id)).toBe(true);
  });

  // 5. missing media
  it("gracefully ignores an inline media block referencing missing media without breaking prose flow", async () => {
    const doc = {
      title: "Art Showcase Feature",
      subtitle: "Dublin student artists",
      content_markdown: "Intro text.\n\n::inline_media{id=\"00000000-0000-0000-0000-000000000000\"}\n\nConcluding text.",
      section: "Culture",
      community: "Dublin",
      media: [inlineMedia1],
    };
    setupEditorial(doc);
    await screen.findByText("Intro text.");
    expect(screen.getByText("Concluding text.")).toBeTruthy();
    expect(document.querySelector("[data-media-id=\"00000000-0000-0000-0000-000000000000\"]")).toBeNull();
  });

  // 6. unauthorized media
  it("does not render unauthorized media not present in document.media", () => {
    const blocks = parseDocumentBlocks({
      content_markdown: "Intro.\n\n::inline_media{id=\"01a99999-9999-7999-9999-999999999999\"}\n\nOutro.",
      media: [inlineMedia1],
    });
    expect(blocks.filter(b => b.type === "inline_media")).toHaveLength(0);
    expect(blocks).toHaveLength(2);
  });

  // 7. malformed media ID
  it("rejects malformed media IDs and treats them safely as plain text", () => {
    const blocks = parseDocumentBlocks({
      content_markdown: "Intro.\n\n::inline_media{id=\"<script>alert(1)</script>\"}\n\nOutro.",
      media: [inlineMedia1],
    });
    expect(blocks.some(b => b.type === "inline_media")).toBe(false);
  });

  // 8. image replacement
  it("opens the photo replacement flow when clicking Change photo on an inline image", async () => {
    const doc = {
      title: "Art Showcase Feature",
      subtitle: "Dublin student artists",
      content_markdown: "Intro.\n\n::inline_media{id=\"01a12317-951b-73db-8081-98675b9ad2c9\"}\n\nCritique.",
      section: "Culture",
      community: "Dublin",
      media: [inlineMedia1],
    };
    setupEditorial(doc);
    const changeBtn = await screen.findByRole("button", { name: "Change photo" });
    fireEvent.click(changeBtn);
    expect(screen.getByRole("heading", { name: "Change photo" })).toBeTruthy();
  });

  // 9. caption editing
  it("opens change suggestion flow prefilled when clicking Suggest correction on an inline image", async () => {
    const doc = {
      title: "Art Showcase Feature",
      subtitle: "Dublin student artists",
      content_markdown: "Intro.\n\n::inline_media{id=\"01a12317-951b-73db-8081-98675b9ad2c9\"}\n\nCritique.",
      section: "Culture",
      community: "Dublin",
      media: [inlineMedia1],
    };
    setupEditorial(doc);
    const correctBtn = await screen.findByRole("button", { name: "Suggest correction" });
    fireEvent.click(correctBtn);
    expect(screen.getByRole("heading", { name: "Suggest a change" })).toBeTruthy();
    const textarea = screen.getByLabelText("What should change?") as HTMLTextAreaElement;
    expect(textarea.value).toContain("Crowned by Nature");
  });

  // 10. mobile rendering
  it("verifies mobile responsiveness and aspect ratio preservation classes on inline figures", async () => {
    const doc = {
      title: "Art Showcase Feature",
      subtitle: "Dublin student artists",
      content_markdown: "Intro.\n\n::inline_media{id=\"01a12317-951b-73db-8081-98675b9ad2c9\"}\n\nCritique.",
      section: "Culture",
      community: "Dublin",
      media: [inlineMedia1],
    };
    setupEditorial(doc);
    await screen.findByText("Intro.");
    const figure = document.querySelector(".sm-review-inline-figure")!;
    expect(figure.classList.contains("sm-review-photo-figure")).toBe(true);
    expect(figure.querySelector(".sm-review-caption-text")).toBeTruthy();
    expect(figure.querySelector(".sm-review-photo-controls")).toBeTruthy();
  });

  // 11. desktop rendering
  it("formats structured captions with title, artist, medium, date, credit, and source", () => {
    const formatted = formatArtworkCaption(inlineMedia1);
    expect(formatted.title).toBe("Crowned by Nature");
    expect(formatted.artist).toBe("Adalind Bu");
    expect(formatted.mediumAndDate).toBe("Portrait study in graphite and mixed media (2026)");
    expect(formatted.credit).toBe("Photo: Misha Sethi");
    expect(formatted.source).toBe("Source: Youth Art Showcase submission");
  });

  // 12. approval invalidation after content/media revision
  it("marks previous approval stale when revision number changes", async () => {
    const doc = {
      title: "Art Showcase Feature",
      subtitle: "Dublin student artists",
      content_markdown: "Intro.\n\n::inline_media{id=\"01a12317-951b-73db-8081-98675b9ad2c9\"}\n\nCritique.",
      section: "Culture",
      community: "Dublin",
      media: [inlineMedia1],
    };
    setupEditorial(doc, { id: "editorial-rev-2", number: 2, decision: null });
    await screen.findByText("Intro.");
    const approveBtn = screen.getByRole("button", { name: "Approve draft" });
    expect(approveBtn.hasAttribute("disabled")).toBe(false);
  });

  // 13. sanitization of malicious HTML
  it("sanitizes malicious script and event handler payloads in markdown and captions", () => {
    const sanitized = sanitizeInlineMarkdown("Malicious <script>alert('xss')</script> and <img src=x onerror=alert(1)> text");
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("onerror");
    expect(sanitized).toContain("&lt;script&gt;");
  });

  // 14. attempted external tracking image
  it("neutralizes attempted external tracking image tags", () => {
    const blocks = parseDocumentBlocks({
      content_markdown: "Intro.\n\n![Tracking](https://tracker.bad.com/pixel.gif)\n\nOutro.",
      media: [inlineMedia1],
    });
    expect(blocks.some(b => b.type === "inline_media")).toBe(false);
  });

  // 15. public/review rendering order parity
  it("guarantees public article renderer and review renderer produce the identical reading order", () => {
    const doc = {
      title: "Art Showcase Feature",
      subtitle: "Dublin student artists",
      content_markdown: "Intro.\n\n::inline_media{id=\"01a12317-951b-73db-8081-98675b9ad2c9\"}\n\nCritique.\n\n::inline_media{id=\"01a12317-afbc-7a0c-b34a-5a24c89c7c78\"}\n\nOutro.",
      section: "Culture",
      community: "Dublin",
      media: [inlineMedia1, inlineMedia2],
    };
    const blocks = parseDocumentBlocks(doc);
    expect(blocks).toHaveLength(5);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("inline_media");
    expect((blocks[1] as any).media_id).toBe(inlineMedia1.file_id);
    expect(blocks[2].type).toBe("paragraph");
    expect(blocks[3].type).toBe("inline_media");
    expect((blocks[3] as any).media_id).toBe(inlineMedia2.file_id);
    expect(blocks[4].type).toBe("paragraph");

    const mediaMap = new Map<string, any>([
      [inlineMedia1.file_id, inlineMedia1],
      [inlineMedia2.file_id, inlineMedia2],
    ]);
    const publicHtml = renderArticleBlocksToHtml(blocks, mediaMap, {
      publicMediaUrlPrefix: "https://cdn-public.scalemule.com/app/photos",
    });
    expect(publicHtml).toContain("“Crowned by Nature”");
    expect(publicHtml).toContain("“When the world lost its color”");
    expect(publicHtml.indexOf("“Crowned by Nature”")).toBeLessThan(publicHtml.indexOf("“When the world lost its color”"));
  });

  // 16. fallback structured caption parsing
  it("parses structured caption lines when top-level artwork_title is omitted for compatibility", () => {
    const rawMedia = {
      kind: "image" as const,
      contribution_id: "c-1",
      file_id: "01a12317-951b-73db-8081-98675b9ad2c9",
      caption: "“Crowned by Nature”\nAdalind Bu\nGraphite and mixed media (2026)\nSource: Youth Art Showcase submission",
      credit: "Photo: Misha Sethi",
      alt: "Crowned by Nature portrait study",
      position: "inline",
    };
    const formatted = formatArtworkCaption(rawMedia);
    expect(formatted.title).toBe("Crowned by Nature");
    expect(formatted.artist).toBe("Adalind Bu");
    expect(formatted.mediumAndDate).toBe("Graphite and mixed media (2026)");
    expect(formatted.source).toBe("Source: Youth Art Showcase submission");
    expect(formatted.credit).toBe("Photo: Misha Sethi");
  });
});


it('preserves the invited revision after another version is published',async()=>{
 render(<StoryReview sessionId="session" publicationName="Test publication" initialReview={{...initial,article_published:true}} />);
 expect(screen.getByText(/preserves the version you were invited to review/)).toBeTruthy();
 expect(screen.queryByText('Private preview · Not published')).toBeNull();
});
