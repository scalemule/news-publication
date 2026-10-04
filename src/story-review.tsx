"use client";
import React, { useEffect, useState } from "react";
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
};
const human = (s: string) => s.toLowerCase().replaceAll("_", " ");
export function StoryReview({
  sessionId,
  publicationName,
}: {
  sessionId: string;
  publicationName: string;
}) {
  const base = `/api/news/review/${encodeURIComponent(sessionId)}`;
  const [review, setReview] = useState<Review | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [panel, setPanel] = useState("article"),
    [verification, setVerification] = useState(false),
    [code, setCode] = useState("");
  const [message, setMessage] = useState(""),
    [document, setDocument] = useState<Document | null>(null),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [file, setFile] = useState<File | null>(null),
    [rights, setRights] = useState(false),
    [compare, setCompare] = useState(""),
    [compareTo, setCompareTo] = useState(""),
    [editingMedia, setEditingMedia] = useState(""),
    [commentTarget, setCommentTarget] = useState("STORY");
  const [mediaInfo, setMediaInfo] = useState({
    caption: "",
    who_is_pictured: "",
    creator: "",
    when_taken: "",
    where_taken: "",
    credit: "",
    alt: "",
  });
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
      throw new Error(
        result.error?.message ||
          "This private review is unavailable. Please contact the newsroom.",
      );
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
      setDocument(data.revision.document);
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
            setDocument(data.revision.document);
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
    if (!review) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request("", { revision_id: review.revision.id, ...action });
      await load();
      setNotice(success);
      setPanel("article");
      setMessage("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save your response.",
      );
    } finally {
      setBusy(false);
    }
  }
  const can = (p: string) => review?.permissions.includes(p);
  async function upload() {
    if (!review || !file || !rights) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set(
        "metadata",
        JSON.stringify({ ...mediaInfo, rights_confirmed: true }),
      );
      await request("/media", form);
      await load();
      setFile(null);
      setRights(false);
      setNotice(
        "Media received privately. The newsroom will review it before publication.",
      );
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
    <main className="sm-story-review">
      <div className="sm-review-private">
        <strong>Private story preview</strong>
        <span>
          {review?.published
            ? "This revision has been published. This review link remains private."
            : "This article has not been published."}
        </span>
      </div>
      <header className="sm-review-masthead">
        {review?.publication.name || publicationName}
      </header>
      {error && (
        <p role="alert" className="sm-review-alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="sm-review-notice">
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
          <div className="sm-review-intro">
            <p>
              Prepared for {review.reviewer} · Version {review.revision.number}
            </p>
            <p>
              {["FACT_CHECK", "CONTRIBUTOR_REVIEW"].includes(
                review.review_policy,
              )
                ? "Please help us check the facts and represent your contribution accurately. The newsroom retains the final editorial decision."
                : "This voluntary announcement requires subject approval before publication. You may request changes or decline participation."}
            </p>
          </div>
          <article className="sm-review-article">
            <p>
              {review.revision.document.section}
              {review.revision.document.community &&
                ` · ${review.revision.document.community}`}
            </p>
            <h1>{review.revision.document.title}</h1>
            <p className="sm-review-dek">{review.revision.document.subtitle}</p>
            <EditorialNotices editorial={review.revision.editorial} />
            {review.revision.document.media
              .filter((m) => m.position === "hero")
              .map((m) => (
                <PrivatePhoto key={m.file_id} media={m} base={base} />
              ))}
            <div
              className="sm-review-prose"
              dangerouslySetInnerHTML={{ __html: review.revision.content_html }}
            />
            {review.revision.document.media
              .filter((m) => m.position !== "hero")
              .map((m) => (
                <PrivatePhoto key={m.file_id} media={m} base={base} />
              ))}
          </article>
          <nav className="sm-review-actions" aria-label="Review actions">
            {can("APPROVE") && !review.published && (
              <button disabled={busy} onClick={() => setPanel("approve")}>
                {review.review_policy === "FACT_CHECK"
                  ? "Confirm fact check"
                  : "Approve draft"}
              </button>
            )}
            {can("REQUEST_CHANGES") && (
              <button disabled={busy} onClick={() => setPanel("changes")}>
                Request changes
              </button>
            )}
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
            {can("UPLOAD_MEDIA") && (
              <button disabled={busy} onClick={() => setPanel("media")}>
                Add photos
              </button>
            )}
            {can("COMMENT") && (
              <button disabled={busy} onClick={() => setPanel("comment")}>
                Leave a comment
              </button>
            )}
            {can("VIEW_SELECTED_HISTORY") && review.history.length > 0 && (
              <button onClick={() => setPanel("history")}>
                Shared history
              </button>
            )}
            {can("DOWNLOAD_PREVIEW") && (
              <button onClick={() => window.print()}>
                Print / save preview
              </button>
            )}
          </nav>
          {panel !== "article" && (
            <section className="sm-review-form" aria-label="Your response">
              <div className="sm-review-form-heading">
                <h2>
                  {panel === "approve"
                    ? "Approve this exact draft"
                    : panel === "edits"
                      ? "Propose changes"
                      : panel === "media"
                        ? "Contribute a photograph"
                        : panel === "questions"
                          ? "Your story, in your words"
                          : panel === "history"
                            ? "Selected revision history"
                            : panel === "decline"
                              ? "Decline participation"
                              : panel === "changes"
                                ? "Request changes"
                                : "Message the newsroom"}
                </h2>
                <button disabled={busy} onClick={() => setPanel("article")}>
                  Close
                </button>
              </div>
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
                    Dek
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
                      "Your answers have been saved for editorial review.",
                    );
                  }}
                >
                  <p>
                    All questions are optional unless marked required. Share
                    only what you would like considered for publication.
                  </p>
                  {review.questions.map((q) => (
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
                  <button disabled={busy}>Send answers</button>
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
                          contribution_id: editingMedia,
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
                  <p>
                    JPEG, PNG or WebP photos up to 12 MB; MP4 or WebM videos up
                    to 25 MB. Media remain private until selected and approved
                    by the newsroom.
                  </p>
                  <label>
                    Photograph or video
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                      required
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  {Object.entries({
                    caption: "Caption",
                    who_is_pictured: "Who is pictured?",
                    creator: "Photographer / creator",
                    when_taken: "When was it taken?",
                    where_taken: "Where was it taken?",
                    credit: "Credit line",
                    alt: "Alt-text suggestion",
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
                  <button disabled={busy || !rights || !file}>
                    Upload privately
                  </button>
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
                        value={commentTarget}
                        onChange={(e) => setCommentTarget(e.target.value)}
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
                          message: message || null,
                          ...(panel === "comment"
                            ? {
                                target: {
                                  kind: commentTarget.split(":")[0],
                                  reference:
                                    commentTarget.split(":")[1] || null,
                                },
                              }
                            : {}),
                        },
                        panel === "approve"
                          ? "Your approval has been recorded for this version."
                          : panel === "decline"
                            ? "Your decision has been recorded."
                            : "Your message has been sent to the newsroom.",
                      )
                    }
                  >
                    {panel === "approve"
                      ? `Approve version ${review.revision.number}`
                      : panel === "changes"
                        ? "Send change request"
                        : panel === "decline"
                          ? "Decline participation"
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
                              setMediaInfo({
                                ...mediaInfo,
                                caption: c.payload.caption || "",
                                credit: c.payload.credit || "",
                                alt: c.payload.caption || "",
                              });
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
          {can("DECLINE") && !review.published && (
            <footer className="sm-review-decline">
              <button disabled={busy} onClick={() => setPanel("decline")}>
                Decline participation / please don’t publish this announcement
              </button>
            </footer>
          )}
        </>
      )}
    </main>
  );
}
function PrivatePhoto({ base, media }: { base: string; media: Media }) {
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
      <figcaption>
        {media.caption}
        {media.credit && ` Photo: ${media.credit}`}
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
