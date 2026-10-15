"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  TOY_AGE_RANGES,
  TOY_CATEGORIES,
  TOY_CONDITIONS,
  TOY_CPSC_RECALLS_URL,
  TOY_EXCLUSIONS,
  TOY_SAFETY,
  TOY_STATUS_LABELS,
  type OwnToyListing,
  type ToyCommunity,
  type ToyContent,
  type ToyMember,
} from "./toys";
import { ToyRoundMark } from "./toys-view";

type Policy = { version: string; text: string; guidelines: string };
export async function toyCall<T>(url: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: data instanceof FormData ? undefined : { "content-type": "application/json" },
    body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof body.error === "string" ? body.error : body.error?.message || "Please try again.");
    (error as Error & { code?: string }).code = typeof body.code === "string" ? body.code : undefined;
    throw error;
  }
  return body.data ?? body;
}
export function ToySignIn({ returnTo = "/account", authPath = "/api/paw-auth" }: { returnTo?: string; authPath?: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="toy-signin">
      <button
        className="toy-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const { url } = await toyCall<{ url: string }>(authPath + "/start?" + new URLSearchParams({ next: returnTo }), "POST");
            window.location.assign(url);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign-in is unavailable.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening sign-in…" : "Continue with your network sign-in"}
      </button>
      {error && (
        <p role="alert" className="toy-error">
          {error}
        </p>
      )}
      <p className="toy-note">Your existing Bay Area News Network sign-in works here. Browsing never needs an account.</p>
    </div>
  );
}
/** Account readiness: display name, home community, 18+ statement and phone verification. */
export function ToyMemberSetup({ member, apiPath = "/api/toys", compact = false }: { member: ToyMember; apiPath?: string; compact?: boolean }) {
  const [name, setName] = useState(member.display_name === "Neighbor" ? "" : member.display_name),
    [home, setHome] = useState(member.community?.id || ""),
    [attest, setAttest] = useState(member.verification.adult_attested),
    [revision, setRevision] = useState(member.revision),
    [saved, setSaved] = useState(member.verification.adult_attested),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [phoneVerified, setPhoneVerified] = useState(member.verification.phone_verified),
    [phoneMessage, setPhoneMessage] = useState("");
  const ready = saved && member.verification.email_verified && phoneVerified;
  return (
    <section className={`toy-form toy-setup${compact ? " toy-setup-compact" : ""}`} aria-labelledby="toy-setup-title">
      <h2 id="toy-setup-title">{ready ? "You're ready to give, swap and request." : "Three quick steps before you can list or request."}</h2>
      <ol className="toy-checklist">
        <li className={member.verification.email_verified ? "done" : ""}>
          <strong>Verified email</strong>
          <span>{member.verification.email_verified ? "Confirmed through your network sign-in." : "Confirm your email from your network account, then sign in again."}</span>
        </li>
        <li className={phoneVerified ? "done" : ""}>
          <strong>Verified phone</strong>
          {phoneVerified ? (
            <span>A working mobile number is confirmed. {TOY_SAFETY.verification}</span>
          ) : (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setPhoneMessage("");
                try {
                  if (!sent) {
                    await toyCall(apiPath + "/phone", "POST", { action: "send", phone });
                    setSent(true);
                    setPhoneMessage("We sent a code by text message.");
                  } else {
                    await toyCall(apiPath + "/phone", "POST", { action: "verify", phone, code });
                    setPhoneVerified(true);
                    setPhoneMessage("Phone verified.");
                  }
                } catch (e) {
                  setPhoneMessage(e instanceof Error ? e.message : "Please try again.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Mobile number
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 925 555 0100" autoComplete="tel" required />
              </label>
              {sent && (
                <label>
                  Code from the text message
                  <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" required />
                </label>
              )}
              <button disabled={busy}>{sent ? "Confirm code" : "Send code"}</button>
              {sent && (
                <button type="button" className="toy-link-button" disabled={busy} onClick={() => setSent(false)}>
                  Use a different number
                </button>
              )}
              {phoneMessage && <p role="status">{phoneMessage}</p>}
              <small>Your number is used for verification and is never shown to other members. {TOY_SAFETY.verification}</small>
            </form>
          )}
        </li>
        <li className={saved ? "done" : ""}>
          <strong>Your public name, community and 18+ statement</strong>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                const result = await toyCall<{ revision: number }>(apiPath + "/member", "PUT", {
                  expected_revision: revision,
                  display_name: name.trim(),
                  home_area_id: home || null,
                  adult_attestation: { version: member.adult_attestation.version, accepted: attest },
                });
                setRevision(result.revision);
                setSaved(attest);
                setMessage(attest ? "Saved." : "Saved. Confirm the 18+ statement to list or request toys.");
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              First name or display name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="Shown on your listings" />
            </label>
            <label>
              Home community
              <select value={home} onChange={(e) => setHome(e.target.value)}>
                <option value="">Choose a community</option>
                {member.communities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="toy-consent">
              <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} />
              <span>{member.adult_attestation.text}</span>
            </label>
            <small>We do not ask for your birth date, identity documents or any child's details.</small>
            <button disabled={busy}>Save</button>
            {message && <p role="status">{message}</p>}
          </form>
        </li>
      </ol>
      {member.status === "suspended" && (
        <aside className="toy-suspended" role="status">
          <h3>Your account is suspended from the exchange.</h3>
          {member.moderation_note && <p>{member.moderation_note}</p>}
          {member.suspended_until && <p>Until {new Date(member.suspended_until).toLocaleDateString()}.</p>}
          {member.appeal_status === "open" ? (
            <p>Your appeal is with the editors.</p>
          ) : (
            <ToyAppealForm apiPath={apiPath} revision={revision} name={name || member.display_name} home={home} onSaved={setRevision} />
          )}
        </aside>
      )}
    </section>
  );
}
function ToyAppealForm({ apiPath, revision, name, home, onSaved }: { apiPath: string; revision: number; name: string; home: string; onSaved: (revision: number) => void }) {
  const [note, setNote] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          const result = await toyCall<{ revision: number }>(apiPath + "/member", "PUT", { expected_revision: revision, display_name: name, home_area_id: home || null, appeal_note: note });
          onSaved(result.revision);
          setMessage("Your appeal was sent to the editors.");
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Appeal
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} required />
      </label>
      <button disabled={busy}>Send appeal</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
const emptyContent: ToyContent = {
  title: "",
  description: "",
  brand: "",
  model: "",
  completeness: "complete",
  missing_parts: "",
  age_guidance: "",
  warnings: "",
  swap_wishes: "",
  recall_check: { searched_cpsc: false, searched_at: null, search_terms: "", result: "", notes: "" },
  attestations: { original_photos: false, damage_disclosed: false, not_excluded: false, not_recalled: false },
};
export function ToyListingForm({
  communities,
  policy,
  initial,
  defaultCommunity,
  apiPath = "/api/toys",
  accountUrl = "/account",
  listingBasePath = "/toys",
}: {
  communities: ToyCommunity[];
  policy: Policy;
  initial?: OwnToyListing;
  defaultCommunity?: string;
  apiPath?: string;
  accountUrl?: string;
  listingBasePath?: string;
}) {
  const [content, setContent] = useState<ToyContent>(initial?.content || emptyContent),
    [exchangeType, setExchangeType] = useState<"giveaway" | "swap">(initial?.exchange_type || "giveaway"),
    [category, setCategory] = useState(initial?.category || "building"),
    [ageRange, setAgeRange] = useState(initial?.age_range || "3-5"),
    [condition, setCondition] = useState(initial?.condition || "good"),
    [community, setCommunity] = useState(initial?.area_id || defaultCommunity || ""),
    [files, setFiles] = useState<{ file: File; key: string; preview: string }[]>([]),
    [step, setStep] = useState(0),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [saved, setSaved] = useState<{ id: string; status: string }>();
  const receipt = useRef<{ id: string; revision: number } | null>(initial ? { id: initial.id, revision: initial.revision } : null);
  const key = useRef("");
  const uploads = useRef(new Set<string>());
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.preview)), [files]);
  const change = <K extends keyof ToyContent>(field: K, value: ToyContent[K]) => setContent((c) => ({ ...c, [field]: value }));
  const a = content.attestations;
  async function save(submit: boolean) {
    setBusy(true);
    setError("");
    try {
      if (!community) throw new Error("Choose the community where you'll exchange.");
      if (submit && !files.length && !initial?.media.length) throw new Error("Add at least one photo of the actual toy.");
      if (submit && !consent) throw new Error("Read and accept the publication permission.");
      const input = {
        area_id: community,
        exchange_type: exchangeType,
        category,
        age_range: ageRange,
        condition,
        content: { ...content, swap_wishes: exchangeType === "swap" ? content.swap_wishes : "", recall_check: { ...content.recall_check, searched_at: content.recall_check.searched_cpsc ? content.recall_check.searched_at || new Date().toISOString() : null } },
        consent: consent ? { version: policy.version, accepted: true } : null,
      };
      if (!key.current) key.current = crypto.randomUUID();
      if (!receipt.current) {
        const result = await toyCall<{ id: string; revision?: number }>(apiPath, "POST", { ...input, submit: false, idempotency_key: key.current });
        receipt.current = { id: result.id, revision: result.revision || 1 };
      } else if (initial && progress === 0 && initial.status !== "draft") {
        // Reviewed listings return to review on edit; the draft save below carries the edit.
      }
      setProgress(1);
      for (const [index, photo] of files.entries()) {
        if (!uploads.current.has(photo.key)) {
          const form = new FormData();
          form.set("file", photo.file);
          form.set("caption", content.title);
          form.set("attribution", "");
          form.set("rights_confirmed", "true");
          form.set("consent_version", policy.version);
          form.set("idempotency_key", photo.key);
          await toyCall(`${apiPath}/submissions/${receipt.current.id}/media`, "POST", form);
          uploads.current.add(photo.key);
        }
        setProgress(index + 2);
      }
      const result = await toyCall<{ id: string; revision: number; status: string }>(`${apiPath}/${receipt.current.id}`, "PUT", { ...input, submit, expected_revision: receipt.current.revision });
      receipt.current = { id: result.id, revision: result.revision };
      setSaved({ id: result.id, status: result.status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't save this listing. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (saved)
    return (
      <section className="toy-form" role="status">
        <ToyRoundMark size={56} />
        <h1>{saved.status === "draft" ? "Draft saved." : "Thanks — your listing is in review."}</h1>
        <p>{saved.status === "draft" ? "Only you can see this draft. Submit it when you're ready." : "A local editor checks the photos, the recall search and the disclosures before it appears. You'll see it under My toys."}</p>
        <a className="toy-button" href={accountUrl}>
          Go to My toys
        </a>
      </section>
    );
  return (
    <form
      className="toy-form toy-listing-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        if (step === 0) {
          setError("");
          setStep(1);
          window.scrollTo({ top: 0 });
        } else void save(true);
      }}
    >
      <header className="toy-form-intro">
        <ol className="toy-form-steps" aria-label="Listing progress">
          <li aria-current={step === 0 ? "step" : undefined}>1. The toy</li>
          <li aria-current={step === 1 ? "step" : undefined}>2. Preview & permission</li>
        </ol>
        <h1>{step === 0 ? (initial ? "Update your listing." : "Give or swap a toy.") : "Looks good."}</h1>
        <p className="toy-note">{step === 0 ? "Real photos, honest condition, and a quick recall search. Editors review every listing." : "Check the details. Nothing is published until an editor approves it."}</p>
      </header>
      {step === 0 ? (
        <div className="toy-form-body">
          <fieldset>
            <legend>Giveaway or swap?</legend>
            <label className="toy-radio">
              <input type="radio" name="exchange_type" checked={exchangeType === "giveaway"} onChange={() => setExchangeType("giveaway")} /> Free giveaway — nothing asked in return
            </label>
            <label className="toy-radio">
              <input type="radio" name="exchange_type" checked={exchangeType === "swap"} onChange={() => setExchangeType("swap")} /> Direct swap — a neighbor offers one of their toys
            </label>
            {exchangeType === "swap" && (
              <label>
                What are you hoping to swap for? (optional)
                <input value={content.swap_wishes} maxLength={300} onChange={(e) => change("swap_wishes", e.target.value)} placeholder="A floor puzzle, a toddler bike…" />
              </label>
            )}
          </fieldset>
          <label>
            Toy name
            <input required maxLength={120} value={content.title} onChange={(e) => change("title", e.target.value)} placeholder="Wooden train set" />
          </label>
          <div className="toy-field-row">
            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {TOY_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Manufacturer age guidance
              <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)}>
                {TOY_AGE_RANGES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Condition
              <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                {TOY_CONDITIONS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Community for the exchange
            <select required value={community} onChange={(e) => setCommunity(e.target.value)}>
              <option value="">Choose a community</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <textarea required maxLength={3000} value={content.description} onChange={(e) => change("description", e.target.value)} placeholder="What's included, how it's been used, anything a neighbor should know." />
          </label>
          <div className="toy-field-row">
            <label>
              Brand (if known)
              <input maxLength={100} value={content.brand} onChange={(e) => change("brand", e.target.value)} />
            </label>
            <label>
              Model or item number (if known)
              <input maxLength={100} value={content.model} onChange={(e) => change("model", e.target.value)} />
            </label>
          </div>
          <fieldset>
            <legend>Completeness and damage</legend>
            <label>
              Is it complete?
              <select value={content.completeness} onChange={(e) => change("completeness", e.target.value as ToyContent["completeness"])}>
                <option value="complete">Complete</option>
                <option value="missing_parts">Missing parts</option>
                <option value="unknown">Not sure</option>
              </select>
            </label>
            {content.completeness === "missing_parts" && (
              <label>
                Which parts are missing?
                <input required maxLength={500} value={content.missing_parts} onChange={(e) => change("missing_parts", e.target.value)} />
              </label>
            )}
            <label>
              Age guidance and warnings printed on the item (if any)
              <input maxLength={200} value={content.age_guidance} onChange={(e) => change("age_guidance", e.target.value)} placeholder="Ages 3+, small parts" />
            </label>
            <label>
              Other manufacturer warnings
              <input maxLength={500} value={content.warnings} onChange={(e) => change("warnings", e.target.value)} />
            </label>
          </fieldset>
          <fieldset className="toy-recall">
            <legend>Recall check</legend>
            <p>
              Search the{" "}
              <a href={TOY_CPSC_RECALLS_URL} target="_blank" rel="noopener noreferrer">
                CPSC recall database
              </a>{" "}
              for the brand and model. Recalled items can't be listed. {TOY_SAFETY.recall}
            </p>
            <label>
              What did you search for?
              <input maxLength={200} value={content.recall_check.search_terms} onChange={(e) => change("recall_check", { ...content.recall_check, search_terms: e.target.value })} placeholder="Brio train 33773" />
            </label>
            <label className="toy-consent">
              <input type="checkbox" checked={content.recall_check.searched_cpsc} onChange={(e) => change("recall_check", { ...content.recall_check, searched_cpsc: e.target.checked, searched_at: e.target.checked ? new Date().toISOString() : null })} />
              <span>I searched the CPSC recall database for this item.</span>
            </label>
            <label>
              Result
              <select value={content.recall_check.result} onChange={(e) => change("recall_check", { ...content.recall_check, result: e.target.value as ToyContent["recall_check"]["result"] })}>
                <option value="">Choose</option>
                <option value="no_match_found">I found no recall for this item</option>
                <option value="unsure">I'm not sure — please have an editor check</option>
                <option value="possible_match">It may be recalled (cannot be listed)</option>
              </select>
            </label>
          </fieldset>
          <fieldset className="toy-exclusions">
            <legend>Not accepted on ToyRound</legend>
            <ul>
              {TOY_EXCLUSIONS.map((item) => (
                <li key={item.key}>{item.label}</li>
              ))}
            </ul>
          </fieldset>
          <label className="toy-photo-picker">
            Photos of the actual toy
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              required={!files.length && !initial?.media.length}
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                if (selected.length + (initial?.media.length || 0) > 10 || selected.some((f) => f.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(f.type))) {
                  setError("Choose up to ten JPEG, PNG or WebP photos, each under 8 MB.");
                  return;
                }
                setError("");
                setFiles(selected.map((file) => ({ file, key: crypto.randomUUID(), preview: URL.createObjectURL(file) })));
              }}
            />
            <span>{files.length ? `${files.length} photo${files.length === 1 ? "" : "s"} selected` : "Choose photos from your device"}</span>
          </label>
          <small>Location data and other metadata are removed from photos. Please keep children out of the pictures.</small>
          {files.length > 0 && (
            <div className="toy-upload-previews" aria-label="Selected photos">
              {files.map((file) => (
                <img key={file.key} src={file.preview} alt={`Selected photo: ${file.file.name}`} width={120} height={120} />
              ))}
            </div>
          )}
          {initial?.media.map((photo) => (
            <img className="toy-existing-photo" key={photo.id} src={`${apiPath}/submissions/${initial.id}/media/${photo.id}`} alt={photo.caption || content.title} width={160} height={120} />
          ))}
          <fieldset>
            <legend>Your statements</legend>
            <label className="toy-consent">
              <input type="checkbox" required checked={a.original_photos} onChange={(e) => change("attestations", { ...a, original_photos: e.target.checked })} />
              <span>These are my own photos of this exact item.</span>
            </label>
            <label className="toy-consent">
              <input type="checkbox" required checked={a.damage_disclosed} onChange={(e) => change("attestations", { ...a, damage_disclosed: e.target.checked })} />
              <span>I have disclosed all damage, wear and missing pieces.</span>
            </label>
            <label className="toy-consent">
              <input type="checkbox" required checked={a.not_excluded} onChange={(e) => change("attestations", { ...a, not_excluded: e.target.checked })} />
              <span>This item is not in a category listed above as not accepted.</span>
            </label>
            <label className="toy-consent">
              <input type="checkbox" required checked={a.not_recalled} onChange={(e) => change("attestations", { ...a, not_recalled: e.target.checked })} />
              <span>To the best of my knowledge this item has not been recalled and is not visibly unsafe.</span>
            </label>
          </fieldset>
        </div>
      ) : (
        <div className="toy-form-body">
          <article className="toy-preview">
            {files[0] && <img src={files[0].preview} alt={`Preview of ${content.title}`} width={800} height={600} />}
            <p className="toy-context">
              {exchangeType === "swap" ? "Swap" : "Free"} · {communities.find((c) => c.id === community)?.name}
            </p>
            <h2>{content.title}</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{content.description}</p>
            <p className="toy-note">
              {TOY_CATEGORIES.find((c) => c.key === category)?.label} · {TOY_AGE_RANGES.find((c) => c.key === ageRange)?.label} · {TOY_CONDITIONS.find((c) => c.key === condition)?.label}
            </p>
          </article>
          <details>
            <summary>Publication permission and guidelines</summary>
            <p>{policy.text}</p>
            <p>{policy.guidelines}</p>
          </details>
          <label className="toy-consent">
            <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I have read and accept the publication permission.</span>
          </label>
        </div>
      )}
      {error && (
        <p role="alert" className="toy-error">
          {error}
        </p>
      )}
      {busy && (
        <label>
          Saving
          <progress value={progress} max={files.length + 2} />
        </label>
      )}
      <div className="toy-form-actions">
        {step === 1 && (
          <button type="button" className="toy-button toy-button-secondary" disabled={busy} onClick={() => setStep(0)}>
            Keep editing
          </button>
        )}
        {step === 0 && !initial && (
          <button type="button" className="toy-button toy-button-secondary" disabled={busy} onClick={() => void save(false)}>
            Save draft
          </button>
        )}
        <button className="toy-button" disabled={busy} type="submit">
          {busy ? "Saving…" : step === 0 ? "Preview listing" : "Submit for review"}
        </button>
      </div>
      <p className="toy-note">{step === 0 ? "Next: a private preview. Nothing is published yet." : "Your listing stays private until an editor approves it."}</p>
      {initial && (
        <p className="toy-note">
          Current status: {(TOY_STATUS_LABELS[initial.status] || initial.status)}. <a href={`${listingBasePath}/${initial.id}`}>View listing</a>
        </p>
      )}
    </form>
  );
}
export function ToyOwnerActions({ listing, apiPath = "/api/toys", submitUrl = "/submit" }: { listing: OwnToyListing; apiPath?: string; submitUrl?: string }) {
  const [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  const editable = !["reserved", "completed", "withdrawn"].includes(listing.status);
  return (
    <div className="toy-form-actions toy-owner-actions">
      {editable && <a href={`${submitUrl}?edit=${listing.id}`}>Edit and resubmit</a>}
      {!["completed", "withdrawn"].includes(listing.status) &&
        (confirm ? (
          <>
            <span>Withdraw this listing{listing.status === "reserved" ? " and cancel the current exchange" : ""}?</span>
            <button
              className="toy-button toy-button-secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await toyCall(`${apiPath}/${listing.id}`, "DELETE", { expected_revision: listing.revision });
                  window.location.reload();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Please try again.");
                  setBusy(false);
                }
              }}
            >
              Yes, withdraw
            </button>
            <button className="toy-button toy-button-secondary" disabled={busy} onClick={() => setConfirm(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button className="toy-link-button" disabled={busy} onClick={() => setConfirm(true)}>
            Withdraw
          </button>
        ))}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
