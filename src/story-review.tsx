"use client";
import React, { useEffect, useRef, useState } from "react";
import { useReviewDrafts, hasDraft, type Draft } from "./story-review-drafts";
import { usePendingPhoto } from "./story-review-photo";
import { proseDiff } from "./story-diff";

type Media = {
  kind?: "image" | "video";
  contribution_id: string;
  file_id: string;
  caption: string;
  credit: string;
  alt: string;
  position: string;
};
type Document = {
  title: string;
  subtitle: string;
  content_markdown: string;
  section: string;
  community: string;
  media: Media[];
};
type Editorial = {
  content_kind?: string;
  disclosure?: string;
  notices?: { kind: string; text: string }[];
};
function EditorialNotices({ editorial }: { editorial?: Editorial }) {
  return editorial ? (
    <aside aria-label="Editorial notices">
      {editorial.content_kind && editorial.content_kind !== "EDITORIAL" && (
        <p>{human(editorial.content_kind)}</p>
      )}
      {editorial.disclosure && <p>{editorial.disclosure}</p>}
      {editorial.notices?.map((n, i) => (
        <p key={i}>
          <strong>{n.kind}: </strong>
          {n.text}
        </p>
      ))}
    </aside>
  ) : null;
}
type Revision = {
  editorial?: Editorial;
  id: string;
  number: number;
  document: Document;
  content_html: string;
};
type Review = {
  response_drafts?: Record<string, Draft>;
  publication: { name: string };
  reviewer: string;
  revision: Revision;
  history: Revision[];
  permissions: string[];
  questions: { id: string; prompt: string; required: boolean }[];
  contributions: {
    id: string;
    kind: string;
    state: string;
    payload: {
      message?: string;
      file_id?: string;
      caption?: string;
      credit?: string;
      answers?: Record<string, string>;
      target?: { kind: string; reference?: string };
      alt?: string;
    };
  }[];
  review_policy: string;
  published: boolean;
  celebration_type?: string | null;
  decision?: string | null;
};
const human = (s: string) => s.toLowerCase().replaceAll("_", " ");
export function StoryReview({
  sessionId,
  publicationName,
  nameplateUrl,
  publicationHeader,
  publicationFooter,
}: {
  sessionId: string;
  publicationName: string;
  nameplateUrl?: string;
  /** The publication supplies its real shell; private content still loads only through the review capability. */
  publicationHeader?: React.ReactNode;
  publicationFooter?: React.ReactNode;
}) {
  const base = `/api/news/review/${encodeURIComponent(sessionId)}`;
  const [review, setReview] = useState<Review | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [panel, setPanel] = useState("article"),
    [verification, setVerification] = useState(false),
    [code, setCode] = useState("");
  const [rights, setRights] = useState(false),
    [compare, setCompare] = useState(""),
    [compareTo, setCompareTo] = useState(""),
    [editingMedia, setEditingMedia] = useState(""),
    [commentTarget, setCommentTarget] = useState("STORY");
  const pendingPhoto = usePendingPhoto(review ? `${sessionId}:${review.revision.id}` : undefined);
  const file = pendingPhoto.photo?.file || null;
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (notice) { noticeRef.current?.scrollIntoView({ block: "center" }); noticeRef.current?.focus({ preventScroll: true }); } }, [notice]);
  const responseRef = useRef<HTMLElement>(null);
  const thanksRef = useRef<HTMLElement>(null);
  const [moreQuestions, setMoreQuestions] = useState(false);

  const [replacementPhoto, setReplacementPhoto] = useState<Media | null>(null);
  function openMedia(photo: Media | null = null) {
    setReplacementPhoto(photo);
    if (file) { setPanel("media"); return; }
    setRights(false);
    setPanel("media");
  }
  useEffect(() => {
    if (panel !== "article") {
      responseRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "auto"
          : "smooth",
      });
      responseRef.current?.focus({ preventScroll: true });
    }
  }, [panel]);
  const emptyMediaInfo = { caption: "", who_is_pictured: "", creator: "", when_taken: "", where_taken: "", credit: "", alt: "" };
  const drafts = useReviewDrafts(sessionId, review?.revision.id, review?.response_drafts, request);
  const currentDraft = drafts.entries[panel];
  const message: string = currentDraft?.data.message || "";
  const answers: Record<string, string> = drafts.entries.questions?.data.answers || {};
  const document: Document | null = drafts.entries.edits?.data.document || review?.revision.document || null;
  const correctionKind: string = drafts.entries.changes?.data.correctionKind || "Correct a detail";
  const mediaPanel = panel === "metadata" ? "metadata" : "media";
  const mediaInfo: typeof emptyMediaInfo = { ...emptyMediaInfo, ...drafts.entries[mediaPanel]?.data.mediaInfo };
  function setMessage(value: string) {
    drafts.set(panel, value.trim() ? { ...currentDraft?.data, message: value, ...(panel === "changes" ? { correctionKind } : {}), ...(panel === "comment" ? { commentTarget } : {}) } : {});
  }
  function setAnswers(value: Record<string, string>) {
    drafts.set("questions", Object.values(value).some(a => a.trim()) ? { answers: value } : {});
  }
  function setDocument(value: Document) {
    drafts.set("edits", JSON.stringify(value) === JSON.stringify(review?.revision.document) ? {} : { document: value });
  }
  function setCorrectionKind(value: string) {
    drafts.set("changes", { ...drafts.entries.changes?.data, correctionKind: value });
  }
  function setMediaInfo(value: typeof emptyMediaInfo) {
    drafts.set(mediaPanel, Object.values(value).some(v => v.trim()) ? { mediaInfo: value, editingMedia, replacementPhoto } : {});
  }
  const pending = Object.entries(drafts.entries).filter(([, entry]) => hasDraft(entry.data));
  const draftLabel = (name: string) => ({ questions: "your answers", changes: "your correction", media: "your photograph details", metadata: "your caption changes", edits: "your wording changes", comment: "your comment", decline: "your response", approve: "your approval message" }[name] || "your response");
  async function request(path = "", body?: unknown): Promise<any> {
    const form = body instanceof FormData;
    const r = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers:
        body === undefined || form
          ? {}
          : { "content-type": "application/json" },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    });
    const result = await r.json();
    if (!r.ok || result.success === false)
      throw Object.assign(new Error(result.error?.message || "This private review is unavailable. Please contact the newsroom."), { status: r.status });
    return result.data ?? result;
  }
  async function load() {
    const data = await request();
    if (data.verification_required) {
      setVerification(true);
      setReview(null);
    } else {
      setVerification(false);
      setReview(data);

    }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = window.location.hash.slice(1);
        if (token) {
          await request("/session", { token });
          window.history.replaceState(null, "", window.location.pathname);
        }
        const data = await request();
        if (active) {
          if (data.verification_required) {
            setVerification(true);
            setReview(null);
          } else {
            setVerification(false);
            setReview(data);

          }
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Unable to open review.");
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionId]);
  async function send(action: Record<string, unknown>, success: string) {
    if (!review || busy) return;
    if (action.action === "APPROVE" && file) {
      setNotice("Your photo is not uploaded yet. Upload it or remove the selection before approving."); setPanel("media"); return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const actionPanel = ({ ANSWER_QUESTIONS: "questions", REQUEST_CHANGES: "changes", COMMENT: "comment", PROPOSE_EDITS: "edits", EDIT_MEDIA_METADATA: "metadata", APPROVE: "approve", DECLINE: "decline" } as Record<string, string>)[String(action.action)];
      const receipt = actionPanel ? await drafts.receipt(actionPanel) : undefined;
      const sent = await request("", { revision_id: review.revision.id, ...action, ...(receipt ? { draft: receipt } : {}) });
      if (sent.cleared_draft) drafts.consumed(sent.cleared_draft);
      try { await load(); } catch { success += " Refresh to see the latest preview."; }
      setNotice(success);
      setPanel("article");

    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save your response.",
      );
    } finally {
      setBusy(false);
    }
  }
  const can = (p: string) => review?.permissions.includes(p);
  const celebration = !!review?.celebration_type;
  const approved = review?.decision === "APPROVED";
  const finalEditor = review?.review_policy === "SUBJECT_APPROVAL_PLUS_EDITOR";
  const approvalThanks = `Thank you. We're glad to help commemorate this special occasion. This version has been sent to the ${review?.publication.name || publicationName} newsroom for final editorial review. It has not been published yet.`;
  useEffect(() => {
    if (approved && finalEditor && thanksRef.current) {
      thanksRef.current.scrollIntoView({ block: "start" });
      thanksRef.current.focus({ preventScroll: true });
    }
  }, [approved, finalEditor]);
  const approve = () => {
    if (pending.length || file) {
      setNotice("You have a response in progress. Send it or discard it, then return to approve the story.");
      setPanel(file ? "media" : pending[0][0]);
      return;
    }
    if (
      celebration &&
      finalEditor &&
      !review?.questions.some((q) => q.required)
    )
      void send({ action: "APPROVE", message: null }, approvalThanks);
    else setPanel("approve");
  };
  function choosePhoto(selected: File | null) {
    if (!selected) return;
    const photo = ["image/jpeg", "image/png", "image/webp"].includes(selected.type);
    const video = ["video/mp4", "video/webm"].includes(selected.type);
    if ((!photo && !video) || selected.size > (photo ? 12 : 25) * 1024 * 1024) {
      setError("Please choose a JPEG, PNG or WebP photo up to 12 MB, or an MP4/WebM video up to 25 MB. For an HEIC photo, export or share it as JPEG first."); return;
    }
    setError(""); setRights(false);
    void pendingPhoto.select(selected, replacementPhoto);
  }
  async function upload() {
    if (!review || !file || !rights || busy) return;
    const replacementPhoto = pendingPhoto.photo?.replacement;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set(
        "metadata",
        JSON.stringify({ ...mediaInfo, rights_confirmed: true }),
      );
      const received = await request("/media", form);
      let uploadNotice = "Media received privately. The newsroom will review it before publication.";
      if (replacementPhoto) {
        uploadNotice = "Your replacement photo has been sent to the newsroom. The current photo will stay in this preview until we prepare an updated draft.";
        if (can("COMMENT")) {
          try {
            await request("", {
              revision_id: review.revision.id,
              action: "COMMENT",
              message: "Please use my newly uploaded photograph in place of this photo.",
              target: {
                kind: "PHOTO",
                reference: replacementPhoto.contribution_id,
                replacement_contribution_id: received.id,
              },
            });
          } catch {
            uploadNotice = "Your photo was uploaded privately, but we couldn't attach the replacement note. Please use Suggest a Change to tell the newsroom which photograph it should replace.";
          }
        } else {
          uploadNotice = "Your photo was uploaded privately for newsroom review. The newsroom will select the photo for the next preview.";
        }
      }
      // The file is already received; never invite a duplicate upload if a later refresh fails.
      await pendingPhoto.select(null);
      try { await drafts.discard("media"); } catch { uploadNotice += " Your saved caption details still need to be cleared; you do not need to upload the photo again."; }
      try { await load(); } catch { uploadNotice += " Refresh to see the received photo below."; }
      setRights(false);
      setNotice(uploadNotice);
      setReplacementPhoto(null);
      setPanel("article");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  const revisions = review
    ? [
        review.revision,
        ...review.history.filter((r) => r.id !== review.revision.id),
      ]
    : [];
  const selected = revisions.find((r) => r.id === compare),
    selectedAfter = revisions.find(
      (r) => r.id === (compareTo || review?.revision.id),
    );
  return (
    <div className={`sm-review-frame${publicationHeader ? " sm-review-publication-frame" : ""}`}>
      <div className="sm-review-banner-wrap">
      <div className="sm-review-private">
        <strong>
          {review?.published
            ? "Private review"
            : "Private preview · Not published"}
        </strong>
        <span>
          {review?.published
            ? "This revision has been published. This review link remains private."
            : `Prepared by ${publicationName} for ${celebration ? "family " : ""}review.`}
        </span>
      </div>
      </div>
      {publicationHeader ?? <div className="sm-review-brand-wrap"><header className="sm-review-masthead">
        {nameplateUrl && (
          <img src={nameplateUrl} alt="" width={80} height={80} />
        )}
        <span>{review?.publication.name || publicationName}</span>
      </header></div>}
      <main className={`sm-story-review${celebration ? " sm-review-celebration" : ""}`}>
      {error && (
        <p role="alert" className="sm-review-alert">
          {error}
        </p>
      )}
      {notice && !(approved && finalEditor && notice === approvalThanks) && (
        <p ref={noticeRef} tabIndex={-1} role="status" className="sm-review-notice">
          {notice}
        </p>
      )}
      {verification && (
        <section className="sm-review-form">
          <h2>Verify your email</h2>
          <p>
            The editor requires verification using the email address on your
            invitation. Your story remains private until verified.
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await request("/verify", {});
                setNotice(
                  "A code was sent to the email address chosen by the editor. It expires in ten minutes.",
                );
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not send code.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Email me a verification code
          </button>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await request("/verify", { code });
                await load();
                setCode("");
                setNotice("Email verified.");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Verification failed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Eight-digit code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{8}"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button disabled={busy}>Verify and open preview</button>
          </form>
        </section>
      )}
      {!review && !error && !verification && (
        <p role="status">Opening your private preview…</p>
      )}
      {review && document && (
        <>
          {celebration ? (
            <div className="sm-review-intro">
              {review.revision.number > 1 ? (
                <p>
                  <strong>Updated preview</strong> — We incorporated the
                  information you sent us.
                </p>
              ) : (
                <p>
                  A special occasion, thoughtfully told. Read your announcement
                  below.
                </p>
              )}
              <a href="#review-options">Review options</a>
            </div>
          ) : (
            <div className="sm-review-intro">
              <p>
                Prepared for {review.reviewer} · Version{" "}
                {review.revision.number}
              </p>
              <p>
                {["FACT_CHECK", "CONTRIBUTOR_REVIEW"].includes(
                  review.review_policy,
                )
                  ? "Please help us check the facts and represent your contribution accurately. The newsroom retains the final editorial decision."
                  : "Please review this announcement. You may suggest changes or decline participation."}
              </p>
            </div>
          )}
          {approved && finalEditor && !review.published && (
            <section ref={thanksRef} tabIndex={-1} className="sm-review-thanks" role="status">
              <h2>Thank you.</h2>
              <p>We're glad to help commemorate this special occasion.</p>
              <p>
                This version has been sent to the {review.publication.name}{" "}
                newsroom for final editorial review. It has not been published
                yet.
              </p>
            </section>
          )}
          <article className="sm-review-article">
            <p className="sm-review-category">
              <span>{review.revision.document.section}</span>
              {celebration && (
                <span>{human(review.celebration_type || "")}</span>
              )}
            </p>
            <h1>{review.revision.document.title}</h1>
            <p className="sm-review-dek">{review.revision.document.subtitle}</p>
            <EditorialNotices editorial={review.revision.editorial} />
            {review.revision.document.media
              .filter((m) => m.position === "hero")
              .map((m) => (
                <PrivatePhoto key={m.file_id} media={m} base={base}
                  onChange={can("UPLOAD_MEDIA") ? () => openMedia(m) : undefined}
                  disabled={busy} />
              ))}
            {celebration &&
              !review.revision.document.media.some(
                (m) => m.position === "hero",
              ) &&
              can("UPLOAD_MEDIA") && (
                <aside
                  className="sm-review-photo-invitation"
                  aria-label="Family photograph"
                >
                  <div>
                    <strong>A photograph makes it yours.</strong>
                    <p>Family photograph may be added before publication.</p>
                  </div>
                  <button onClick={() => openMedia()}>
                    + Add a photograph
                  </button>
                </aside>
              )}
            <div
              className="sm-review-prose"
              dangerouslySetInnerHTML={{ __html: review.revision.content_html }}
            />
            {review.revision.document.media
              .filter((m) => m.position !== "hero")
              .map((m) => (
                <PrivatePhoto key={m.file_id} media={m} base={base}
                  onChange={m.kind !== "video" && can("UPLOAD_MEDIA") ? () => openMedia(m) : undefined}
                  disabled={busy} />
              ))}
          </article>
          {celebration && (
            <section id="review-options" className="sm-review-welcome">
              <h2>Help us make this just right</h2>
              <p>
                We prepared this announcement as a starting point so you don't
                have to write anything yourself. If everything looks right, you
                can simply approve it.
              </p>
              <p>
                If you'd like, you can also correct a detail, add photographs,
                or tell us a little more about the couple. We'll take care of
                turning any additional information into the next draft.
              </p>
              {can("ANSWER_QUESTIONS") && review.questions.length > 0 && (
                <button
                  onClick={() => {
                    setMoreQuestions(false);
                    setPanel("questions");
                  }}
                >
                  Tell Us More
                </button>
              )}
              {can("DECLINE") && !review.published && (
                <button
                  className="sm-review-quiet"
                  onClick={() => setPanel("decline")}
                >
                  Prefer Not to Publish
                </button>
              )}
              {can("COMMENT") && (
                <button className="sm-review-quiet" onClick={() => setPanel("comment")}>
                  Leave a Comment
                </button>
              )}
            </section>
          )}
          <nav
            className={`sm-review-actions${celebration ? " sm-review-concierge-actions" : ""}${panel !== "article" ? " sm-review-actions-editing" : ""}`}
            aria-label="Review actions"
          >
            {can("APPROVE") && !review.published && (
              <button
                className="sm-review-primary"
                disabled={busy || approved || review.decision === "DECLINED"}
                onClick={approve}
              >
                {approved
                  ? "Thank you — Approved"
                  : review.review_policy === "FACT_CHECK"
                    ? "Confirm fact check"
                    : celebration
                      ? "Looks Good — Approve"
                      : "Approve draft"}
              </button>
            )}
            {can("REQUEST_CHANGES") && (
              <button disabled={busy} onClick={() => setPanel("changes")}>
                {celebration ? "Suggest a Change" : "Request changes"}
              </button>
            )}
            {celebration && can("PROPOSE_EDITS") && !can("REQUEST_CHANGES") && (
              <button disabled={busy} onClick={() => setPanel("edits")}>
                Suggest a Change
              </button>
            )}
            {can("UPLOAD_MEDIA") && (
              <button disabled={busy} onClick={() => openMedia()}>
                {celebration ? "Add Photos" : "Add photos"}
              </button>
            )}
            {!celebration && (
              <>
                {can("PROPOSE_EDITS") && (
                  <button disabled={busy} onClick={() => setPanel("edits")}>
                    Suggest edits
                  </button>
                )}
                {can("ANSWER_QUESTIONS") && review.questions.length > 0 && (
                  <button disabled={busy} onClick={() => setPanel("questions")}>
                    Answer questions
                  </button>
                )}
                {can("COMMENT") && (
                  <button disabled={busy} onClick={() => setPanel("comment")}>
                    Leave a comment
                  </button>
                )}
              </>
            )}
          </nav>
          {((can("VIEW_SELECTED_HISTORY") && review.history.length > 0) ||
            can("DOWNLOAD_PREVIEW")) && (
            <div className="sm-review-utilities">
              {can("VIEW_SELECTED_HISTORY") && review.history.length > 0 && (
                <button onClick={() => setPanel("history")}>
                  See previous previews
                </button>
              )}
              {can("DOWNLOAD_PREVIEW") && (
                <button onClick={() => window.print()}>
                  Print / save preview
                </button>
              )}
            </div>
          )}
          {panel === "article" && (pending.length > 0 || file) && <aside className="sm-review-resume" aria-label="Unfinished responses">
            <strong>You have a response in progress</strong>
            <p>Send your response when you're ready, then return here to review and approve the story.</p>
            {pending.map(([name]) => <button key={name} onClick={() => setPanel(name)}>Continue {draftLabel(name)}</button>)}
            {file && !pending.some(([name]) => name === "media") && <button onClick={() => setPanel("media")}>Continue your photo upload</button>}
          </aside>}
          {panel !== "article" && (
            <section
              ref={responseRef}
              tabIndex={-1}
              className="sm-review-form"
              aria-label="Your response"
            >
              <div className="sm-review-form-heading">
                <h2>
                  {panel === "approve"
                    ? "Approve this exact draft"
                    : panel === "edits"
                      ? "Propose changes"
                      : panel === "media"
                        ? replacementPhoto ? "Change photo" : "Contribute a photograph"
                        : panel === "questions"
                          ? "Tell us a little more"
                          : panel === "history"
                            ? "Selected revision history"
                            : panel === "decline"
                              ? "Prefer not to publish"
                              : panel === "changes"
                                ? "Suggest a change"
                                : "Message the newsroom"}
                </h2>
                <button disabled={busy} onClick={() => setPanel("article")}>
                  Close
                </button>
              </div>
              {panel !== "history" && <div className="sm-review-save-state" role="status" aria-live="polite">
                {currentDraft?.status === "conflict" ? <>
                  <p>A response was saved in another tab or device. Your writing here is still available. Choose which version to keep.</p>
                  <button disabled={busy} onClick={() => void drafts.resolve(panel, true).catch(e => setError(e.message))}>Keep what I wrote here</button>
                  <button disabled={busy} onClick={() => void drafts.resolve(panel, false).catch(e => setError(e.message))}>Use the saved response</button>
                </> : currentDraft?.status === "offline" ? <>
                  <p>{currentDraft.local ? "Saved on this device. Waiting for a connection to save online." : "Not saved yet. Keep this page open and try again."}</p>
                  <button disabled={busy} onClick={() => void drafts.flush(panel).catch(e => setError(e.message))}>Try saving again</button>
                </> : <p>{currentDraft?.status === "saving" ? "Saving your writing…" : hasDraft(currentDraft?.data) ? "Saved — not sent yet. You can safely come back later." : "Your writing saves automatically. Use the Send button below when you're ready to share it with the newsroom."}</p>}
                {hasDraft(currentDraft?.data) && <button className="sm-review-quiet" disabled={busy} onClick={() => { if (window.confirm("Discard this unsent response? Responses already sent will be kept.")) void drafts.discard(panel).catch(e => setError(e.message)); }}>Discard this unsent response</button>}
              </div>}
              <fieldset disabled={busy} className="sm-review-response-fields">
              {panel === "edits" && (
                <>
                  <p>
                    Your suggestions will be reviewed by an editor. They do not
                    replace the newsroom’s draft.
                  </p>
                  <label>
                    Headline
                    <input
                      value={document.title}
                      onChange={(e) =>
                        setDocument({ ...document, title: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Short introduction
                    <input
                      value={document.subtitle}
                      onChange={(e) =>
                        setDocument({ ...document, subtitle: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Suggested article text
                    <textarea
                      rows={16}
                      value={document.content_markdown}
                      onChange={(e) =>
                        setDocument({
                          ...document,
                          content_markdown: e.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void send(
                        {
                          action: "PROPOSE_EDITS",
                          title: document.title,
                          subtitle: document.subtitle,
                          content_markdown: document.content_markdown,
                          message,
                        },
                        "Your proposed changes have been sent to the newsroom.",
                      )
                    }
                  >
                    Send proposed changes
                  </button>
                </>
              )}
              {panel === "questions" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(
                      { action: "ANSWER_QUESTIONS", answers },
                      "Thank you for sharing. We'll take care of turning your answers into an updated draft.",
                    );
                  }}
                >
                  <p>
                    {review.questions.some((q) => q.required)
                      ? "Only questions marked required must be answered. Share what you would like considered for publication."
                      : "Completely optional. Even one answer can help us make the announcement more personal."}
                  </p>
                  {review.questions
                    .filter((q, i) => moreQuestions || i < 5 || q.required)
                    .map((q) => (
                      <label key={q.id}>
                        {q.prompt}
                        {q.required ? " (required)" : " (optional)"}
                        <textarea
                          required={q.required}
                          rows={3}
                          value={answers[q.id] || ""}
                          onChange={(e) =>
                            setAnswers({ ...answers, [q.id]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                  <button
                    className="sm-review-primary"
                    disabled={
                      busy || !Object.values(answers).some((a) => a.trim())
                    }
                  >
                    Send These Answers
                  </button>
                  {!moreQuestions && review.questions.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setMoreQuestions(true)}
                    >
                      Answer More Questions
                    </button>
                  )}
                </form>
              )}
              {panel === "metadata" && (
                <>
                  <p>
                    Caption and credit changes are proposals for the newsroom;
                    historical captions remain intact.
                  </p>
                  {(["caption", "credit", "alt"] as const).map((key) => (
                    <label key={key}>
                      {key}
                      <input
                        value={mediaInfo[key]}
                        onChange={(e) =>
                          setMediaInfo({ ...mediaInfo, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <button
                    disabled={busy}
                    onClick={() =>
                      void send(
                        {
                          action: "EDIT_MEDIA_METADATA",
                          contribution_id: drafts.entries.metadata?.data.editingMedia || editingMedia,
                          caption: mediaInfo.caption,
                          credit: mediaInfo.credit,
                          alt: mediaInfo.alt,
                        },
                        "Your proposed media descriptions have been sent to the newsroom.",
                      )
                    }
                  >
                    Propose caption / credit changes
                  </button>
                </>
              )}
              {panel === "media" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void upload();
                  }}
                >
                  {replacementPhoto && <p>Choose the photograph you'd like us to use instead. We'll review it and prepare an updated preview; the current photo stays in place until then.</p>}
                  <p>
                    JPEG, PNG or WebP photos up to 12 MB; MP4 or WebM videos up
                    to 25 MB. Media remain private until selected and approved
                    by the newsroom.
                  </p>
                  <div className="sm-review-photo-picker">
                  <p><strong>1. Choose a photo</strong></p>
                  <button type="button" onClick={() => galleryRef.current?.click()}>Choose from my photos</button>
                  <button type="button" onClick={() => cameraRef.current?.click()}>Take a photo</button>
                  <input ref={cameraRef} aria-label="Take a photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={e => choosePhoto(e.target.files?.[0] || null)} />
                  <label className="sm-review-native-file">
                    Photograph or video
                    <input ref={galleryRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                      onChange={(e) => choosePhoto(e.target.files?.[0] || null)}
                    />
                  </label>
                  </div>
                  {file && <div className="sm-review-selected-photo">
                    {pendingPhoto.preview && <img src={pendingPhoto.preview} alt="Your selected photograph" />}
                    <p><strong>{file.name}</strong></p>
                    <p role="status">{pendingPhoto.saved ? "Photo kept on this device — not uploaded yet." : "Photo selected — not uploaded yet. Keep this page open."}</p>
                    <button type="button" onClick={() => { void pendingPhoto.select(null); setRights(false); }}>Remove selected photo</button>
                  </div>}
                  <p className="sm-review-help">
                    Choose a photograph and confirm permission below. All
                    descriptions are optional; we can help with the caption.
                  </p>
                  {Object.entries({
                    caption: "Caption (optional)",
                    credit: "Photographer / credit (optional)",
                  }).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        value={mediaInfo[key as keyof typeof mediaInfo]}
                        onChange={(e) =>
                          setMediaInfo({ ...mediaInfo, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <details className="sm-review-media-details">
                    <summary>Add more photograph details (optional)</summary>
                    {Object.entries({
                      who_is_pictured: "Who is pictured?",
                      creator: "Photographer / creator",
                      when_taken: "When was it taken?",
                      where_taken: "Where was it taken?",
                      alt: "Describe the photograph for readers who cannot see it",
                    }).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          value={mediaInfo[key as keyof typeof mediaInfo]}
                          onChange={(e) =>
                            setMediaInfo({
                              ...mediaInfo,
                              [key]: e.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
                  </details>
                  <p><strong>2. Confirm permission</strong></p>
                  <label className="sm-review-check">
                    <input
                      type="checkbox"
                      required
                      checked={rights}
                      onChange={(e) => setRights(e.target.checked)}
                    />
                    I confirm that I have the right or permission to provide
                    this media to {review.publication.name} for editorial
                    publication.
                  </label>
                  <div className="sm-review-send-bar">
                    <p>{busy ? "Uploading your photo. Please keep this page open…" : !file ? "Choose a photo above to continue." : !rights ? "Tick the permission box above, then upload your photo." : "Ready. Tap Upload privately to send this photo to the newsroom."}</p>
                    {busy && <progress aria-label="Uploading photo" />}
                    <button className="sm-review-primary" disabled={busy || !rights || !file}>{busy ? "Uploading…" : "Upload privately"}</button>
                  </div>
                </form>
              )}
              {["approve", "changes", "comment", "decline"].includes(panel) && (
                <>
                  {panel === "approve" && (
                    <p>
                      You are approving version {review.revision.number}.
                      Changes to the article require a new approval.
                      {review.review_policy === "SUBJECT_APPROVAL_AUTO_PUBLISH"
                        ? " The editor has configured this version to publish or schedule after the required approvals are received."
                        : " The newsroom will complete its editorial workflow before publication."}
                    </p>
                  )}
                  {panel === "decline" && (
                    <p>
                      {["FACT_CHECK", "CONTRIBUTOR_REVIEW"].includes(
                        review.review_policy,
                      )
                        ? "You can decline this review. The newsroom may still publish its reporting."
                        : "Declining participation prevents publication of this voluntary announcement."}
                    </p>
                  )}
                  {panel === "comment" && (
                    <label>
                      Comment on
                      <select
                        value={currentDraft?.data.commentTarget || commentTarget}
                        onChange={(e) => { setCommentTarget(e.target.value); if (message) drafts.set("comment", { ...currentDraft?.data, commentTarget: e.target.value }); }}
                      >
                        <option value="STORY">Entire story</option>
                        {review.revision.document.content_markdown
                          .split(/\n\s*\n/)
                          .slice(0, 200)
                          .map((_, i) => (
                            <option key={i} value={`PARAGRAPH:${i + 1}`}>
                              Paragraph {i + 1}
                            </option>
                          ))}
                        {review.revision.document.media.map((m, i) => (
                          <option
                            key={m.contribution_id}
                            value={`MEDIA:${m.contribution_id}`}
                          >
                            Photo / caption {i + 1}
                          </option>
                        ))}
                        {review.questions.map((q) => (
                          <option key={q.id} value={`QUESTION:${q.id}`}>
                            {q.prompt}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {panel === "changes" && (
                    <>
                      <label>
                        What would you like to change?
                        <select
                          value={correctionKind}
                          onChange={(e) => setCorrectionKind(e.target.value)}
                        >
                          {[
                            "Correct a detail",
                            "Correct a name",
                            "Correct a professional / education detail",
                            "Remove something",
                            "Rewrite something",
                            "Add something",
                            "General comment",
                          ].map((kind) => (
                            <option key={kind}>{kind}</option>
                          ))}
                        </select>
                      </label>
                      <p>
                        A sentence or two is enough. We'll take care of the
                        wording.
                      </p>
                      {can("PROPOSE_EDITS") && (
                        <button onClick={() => setPanel("edits")}>
                          Or edit the wording directly
                        </button>
                      )}
                    </>
                  )}
                  <label>
                    {panel === "changes"
                      ? "What should change?"
                      : "Message (optional)"}
                    <textarea
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={
                      busy ||
                      (panel === "changes" && !message.trim()) ||
                      (panel === "comment" && !message.trim())
                    }
                    onClick={() =>
                      void send(
                        {
                          action:
                            panel === "approve"
                              ? "APPROVE"
                              : panel === "changes"
                                ? "REQUEST_CHANGES"
                                : panel === "decline"
                                  ? "DECLINE"
                                  : "COMMENT",
                          message:
                            panel === "changes"
                              ? `${correctionKind}: ${message}`
                              : message || null,
                          ...(panel === "comment"
                            ? {
                                target: {
                                  kind: (currentDraft?.data.commentTarget || commentTarget).split(":")[0],
                                  reference:
                                    (currentDraft?.data.commentTarget || commentTarget).split(":")[1] || null,
                                },
                              }
                            : {}),
                        },
                        panel === "approve"
                          ? celebration && finalEditor
                            ? approvalThanks
                            : "Your approval has been recorded for this version."
                          : panel === "decline"
                            ? "Thank you for letting us know. The newsroom has received your decision."
                            : "Your message has been sent to the newsroom.",
                      )
                    }
                  >
                    {panel === "approve"
                      ? `Approve version ${review.revision.number}`
                      : panel === "changes"
                        ? "Send change request"
                        : panel === "decline"
                          ? "Prefer not to publish"
                          : "Send comment"}
                  </button>
                </>
              )}
              {panel === "history" && (
                <>
                  <p>Only revisions selected by the editor are visible here.</p>
                  <label>
                    Compare from
                    <select
                      value={compare}
                      onChange={(e) => setCompare(e.target.value)}
                    >
                      <option value="">Choose a shared revision</option>
                      {revisions.map((r) => (
                        <option key={r.id} value={r.id}>
                          Version {r.number}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Compare to
                    <select
                      value={compareTo || review.revision.id}
                      onChange={(e) => setCompareTo(e.target.value)}
                    >
                      {revisions.map((r) => (
                        <option key={r.id} value={r.id}>
                          Version {r.number}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selected && selectedAfter && (
                    <ReviewDiff before={selected} after={selectedAfter} />
                  )}
                  <details>
                    <summary>Read selected revision</summary>
                    <h3>{selected?.document.title}</h3>
                    <p>{selected?.document.subtitle}</p>
                    <EditorialNotices editorial={selected?.editorial} />
                    <div
                      className="sm-review-prose"
                      dangerouslySetInnerHTML={{
                        __html: selected?.content_html || "",
                      }}
                    />
                    {selected?.document.media.map((m) => (
                      <PrivatePhoto key={m.file_id} media={m} base={base} />
                    ))}
                  </details>
                </>
              )}
              </fieldset>
            </section>
          )}
          {review.contributions.length > 0 && (
            <section className="sm-review-contributions">
              <h2>Your contributions and newsroom messages</h2>
              {review.contributions.map((c) => (
                <div key={c.id}>
                  <p>
                    <strong>{human(c.kind)}</strong> · {human(c.state)}
                  </p>
                  {c.payload.target && (
                    <p>
                      Regarding {human(c.payload.target.kind)}{" "}
                      {c.payload.target.reference}
                    </p>
                  )}
                  {c.payload.message && <p>{c.payload.message}</p>}
                  {c.payload.answers &&
                    Object.entries(c.payload.answers).map(([q, a]) => (
                      <p key={q}>{a}</p>
                    ))}
                  {c.kind === "MEDIA" && c.payload.file_id && (
                    <>
                      <PrivatePhoto
                        base={base}
                        media={{
                          file_id: c.payload.file_id,
                          caption: c.payload.caption || "",
                          credit: c.payload.credit || "",
                          alt: c.payload.caption || "",
                          position: "gallery",
                          contribution_id: c.id,
                        }}
                      />
                      {c.state !== "WITHDRAWN" &&
                        can("EDIT_MEDIA_METADATA") && (
                          <button
                            onClick={() => {
                              setEditingMedia(c.id);
                              if (!hasDraft(drafts.entries.metadata?.data)) drafts.set("metadata", { editingMedia: c.id, mediaInfo: { ...emptyMediaInfo, caption: c.payload.caption || "", credit: c.payload.credit || "", alt: c.payload.alt || "" } });
                              setPanel("metadata");
                            }}
                          >
                            Suggest caption / credit changes
                          </button>
                        )}
                      {c.state !== "WITHDRAWN" && can("UPLOAD_MEDIA") && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void send(
                              {
                                action: "WITHDRAW_MEDIA",
                                contribution_id: c.id,
                              },
                              "Your media has been withdrawn from consideration.",
                            )
                          }
                        >
                          Withdraw this media
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </section>
          )}
          {!celebration && can("DECLINE") && !review.published && (
            <footer className="sm-review-decline">
              <button disabled={busy} onClick={() => setPanel("decline")}>
                Decline participation / please don’t publish this announcement
              </button>
            </footer>
          )}
        </>
      )}
      </main>
      {publicationFooter}
    </div>
  );
}
function PrivatePhoto({ base, media, onChange, disabled }: {
  base: string; media: Media; onChange?: () => void; disabled?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [video, setVideo] = useState(false);
  useEffect(() => {
    let active = true,
      object = "";
    void fetch(`${base}/media/${encodeURIComponent(media.file_id)}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((r) => {
        if (!r.ok) throw new Error("unavailable");
        return r.blob();
      })
      .then((blob) => {
        object = URL.createObjectURL(blob);
        if (active) {
          setUrl(object);
          setVideo(blob.type.startsWith("video/"));
        } else URL.revokeObjectURL(object);
      })
      .catch(() => setUrl(""));
    return () => {
      active = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [base, media.file_id]);
  return (
    <figure>
      {url ? (
        video ? (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            aria-label={media.alt}
          />
        ) : (
          <img src={url} alt={media.alt} referrerPolicy="no-referrer" />
        )
      ) : (
        <p>Media unavailable.</p>
      )}
      <figcaption className="sm-review-photo-details">
      {(media.caption || media.credit) && <span>
        {media.caption}
        {media.credit && ` Photo: ${media.credit}`}
      </span>}
      {onChange && <button className="sm-review-change-photo" type="button" disabled={disabled} onClick={onChange}>Change photo</button>}
      </figcaption>
    </figure>
  );
}
/** Paragraph comparisons preserve readable prose and identify title/dek and media changes. */
export function ReviewDiff({
  before,
  after,
}: {
  before: Revision;
  after: Revision;
}) {
  const [side, setSide] = useState(false);
  const fields: [keyof Document, string][] = [
    ["title", "Headline"],
    ["subtitle", "Dek"],
    ["content_markdown", "Article"],
    ["section", "Section"],
    ["community", "Community"],
  ];
  return (
    <div className="sm-review-diff">
      <h3>
        Version {before.number} compared with version {after.number}
      </h3>
      <label className="sm-review-check">
        <input
          type="checkbox"
          checked={side}
          onChange={(e) => setSide(e.target.checked)}
        />
        Side-by-side
      </label>
      {fields
        .filter(([k]) => before.document[k] !== after.document[k])
        .map(([k, label]) => (
          <section key={k}>
            <h4>{label}</h4>
            <div className={side ? "sm-review-diff-columns" : ""}>
              {side ? (
                <>
                  <del>{String(before.document[k])}</del>
                  <ins>{String(after.document[k])}</ins>
                </>
              ) : (
                proseDiff(
                  String(before.document[k]),
                  String(after.document[k]),
                ).map((run, i) =>
                  run.kind === "added" ? (
                    <ins key={i}>{run.text}</ins>
                  ) : run.kind === "removed" ? (
                    <del key={i}>{run.text}</del>
                  ) : (
                    <span key={i}>{run.text}</span>
                  ),
                )
              )}
            </div>
          </section>
        ))}
      {JSON.stringify(before.editorial) !== JSON.stringify(after.editorial) && (
        <section>
          <h4>Editorial notices and disclosures</h4>
          <div className="sm-review-diff-columns">
            <div>
              <p>Version {before.number}</p>
              <EditorialNotices editorial={before.editorial} />
            </div>
            <div>
              <p>Version {after.number}</p>
              <EditorialNotices editorial={after.editorial} />
            </div>
          </div>
        </section>
      )}
      {JSON.stringify(before.document.media) !==
        JSON.stringify(after.document.media) && (
        <section>
          <h4>Photographs and captions</h4>
          <div className="sm-review-diff-columns">
            {[before, after].map((r) => (
              <div key={r.id}>
                <p>Version {r.number}</p>
                {r.document.media.map((m, i) => (
                  <p key={m.contribution_id}>
                    Photo {i + 1} ({m.position}): {m.caption} — {m.credit} ·
                    Alt: {m.alt}
                    {!before.document.media.some(
                      (previous) => previous.file_id === m.file_id,
                    )
                      ? " · Added photograph"
                      : ""}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
