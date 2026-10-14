"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  PET_CELEBRATIONS,
  PET_PHOTO_CATEGORIES,
  PET_SAFETY,
  type OwnPetResource,
  type PetCommunity,
  type PetContent,
  type PetKind,
} from "./pets";
import { PawMark } from "./pets-view";
function localDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
const empty: PetContent = {
  name: "",
  species: "Dog",
  story: "",
  breed: "",
  personality: "",
  activities: [],
  category: "cute",
  attribution: "",
};
type Policy = { version: string; text: string; guidelines: string };
async function call<T>(
  url: string,
  method: string,
  data?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers:
      data instanceof FormData
        ? undefined
        : { "content-type": "application/json" },
    body:
      data === undefined
        ? undefined
        : data instanceof FormData
          ? data
          : JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.error?.message ||
          "We couldn’t save this contribution. Please try again.",
    );
  return body.data ?? body;
}
export function PetSignIn({ returnTo = "/account" }: { returnTo?: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const { url } = await call<{ url: string }>(
              "/api/paw-auth/start?" + new URLSearchParams({ next: returnTo }),
              "POST",
            );
            window.location.assign(url);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Sign-in is unavailable.",
            );
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening sign-in…" : "Continue with your network sign-in"}
      </button>
      {error && (
        <p role="alert" className="paw-error">
          {error}
        </p>
      )}
      <p className="paw-safety">
        Your existing network sign-in works here. Public browsing is always
        open.
      </p>
    </div>
  );
}
export function PetSubmissionForm({
  communities,
  policy,
  profiles = [],
  initial,
  defaultCommunity,
  apiPath = "/api/pets",
  accountUrl = "/account",
  onSaved,
}: {
  communities: PetCommunity[];
  policy: Policy;
  profiles?: OwnPetResource[];
  initial?: OwnPetResource;
  defaultCommunity?: string;
  apiPath?: string;
  accountUrl?: string;
  onSaved?: (id: string) => void;
}) {
  const [deviceReady, setDeviceReady] = useState(false);
  useEffect(() => setDeviceReady(true), []);
  const [kind, setKind] = useState<PetKind>(initial?.kind || "spotlight"),
    [content, setContent] = useState<PetContent>(initial?.content || empty);
  const [community, setCommunity] = useState(
      initial?.area_id || defaultCommunity || "",
    ),
    [visibility, setVisibility] = useState<"public" | "private">(
      initial?.visibility || "private",
    );
  const [profileId, setProfileId] = useState<string | null>(
    initial?.profile_id || null,
  );
  const [files, setFiles] = useState<
    { file: File; key: string; preview: string }[]
  >([]);
  const [step, setStep] = useState(0),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(0),
    [saved, setSaved] = useState<string>();
  const receipt = useRef<{ id: string; revision: number } | null>(
    initial ? { id: initial.id, revision: initial.revision } : null,
  );
  const key = useRef<string>("");
  const uploads = useRef(new Set<string>());
  useEffect(
    () => () => files.forEach((f) => URL.revokeObjectURL(f.preview)),
    [files],
  );
  const change = <K extends keyof PetContent>(field: K, value: PetContent[K]) =>
    setContent((previous) => ({ ...previous, [field]: value }));
  const needsPermission =
    kind !== "profile" || visibility === "public" || files.length > 0;
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (!community || !content.name.trim())
        throw new Error("Choose a community and enter your pet’s name.");
      if (needsPermission && !consent)
        throw new Error("Read and accept the publication permission.");
      if (
        ["spotlight", "photo", "adoption"].includes(kind) &&
        !files.length &&
        !initial?.media.length
      )
        throw new Error("Choose at least one authentic photograph.");
      const permission = consent
        ? { version: policy.version, accepted: true }
        : null;
      const input = {
        area_id: community,
        kind,
        content: {
          ...content,
          activities: content.activities.filter((v) => v.trim()),
        },
        profile_id: kind === "profile" ? null : profileId,
        visibility: kind === "profile" ? visibility : "public",
        consent: permission,
      };
      if (!key.current) key.current = crypto.randomUUID();
      if (!receipt.current) {
        const result = await call<{ id: string; revision?: number }>(
          apiPath,
          "POST",
          { ...input, submit: false, idempotency_key: key.current },
        );
        receipt.current = { id: result.id, revision: result.revision || 1 };
      } else if (initial && progress === 0) {
        const result = await call<{ id: string; revision: number }>(
          `${apiPath}/${receipt.current.id}`,
          "PUT",
          {
            ...input,
            submit: false,
            expected_revision: receipt.current.revision,
          },
        );
        receipt.current = result;
      }
      setProgress(1);
      for (const [index, photo] of files.entries()) {
        if (!uploads.current.has(photo.key)) {
          const form = new FormData();
          form.set("file", photo.file);
          form.set("caption", content.name);
          form.set("attribution", content.attribution);
          form.set("rights_confirmed", "true");
          form.set("consent_version", policy.version);
          form.set("idempotency_key", photo.key);
          await call(
            `${apiPath}/submissions/${receipt.current.id}/media`,
            "POST",
            form,
          );
          uploads.current.add(photo.key);
        }
        setProgress(index + 2);
      }
      const result = await call<{ id: string; revision: number }>(
        `${apiPath}/${receipt.current.id}`,
        "PUT",
        {
          ...input,
          submit: input.visibility === "public",
          expected_revision: receipt.current.revision,
        },
      );
      receipt.current = result;
      setSaved(result.id);
      onSaved?.(result.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn’t save this contribution. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (saved)
    return (
      <section className="paw-form" role="status">
        <PawMark size={56} />
        <h1>
          {kind === "profile" && visibility === "private"
            ? "A little home for your pet."
            : "Your story is in good hands."}
        </h1>
        <p>
          {kind === "profile" && visibility === "private"
            ? "Your profile is saved privately. Only you can see it."
            : "Your contribution is saved for editorial review. It will appear publicly only after approval."}
        </p>
        <a href={accountUrl}>View your pets and submissions</a>
      </section>
    );
  return (
    <form
      className="paw-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 0) {
          setError("");
          setStep(1);
        } else void save();
      }}
    >
      <p className="paw-context">
        {step === 0 ? "Your pet’s story" : "Your private preview"}
      </p>
      <h1>
        {kind === "celebration" && content.category === "memorial"
          ? "Remember a beloved companion."
          : "Someone worth meeting."}
      </h1>
      <p className="paw-safety">
        Choose a community, never a home address. Keep phone numbers, email
        addresses and microchip details out of your story.
      </p>
      {step === 0 ? (
        <>
          {!initial && (
            <label>
              What would you like to share?
              <select
                value={kind}
                onChange={(e) => {
                  const k = e.target.value as PetKind;
                  setKind(k);
                  setContent((c) => ({
                    ...c,
                    source: ["event", "adoption"].includes(k)
                      ? {
                          organization: "",
                          official_url: "",
                          availability_confirmed: false,
                        }
                      : null,
                    event:
                      k === "event"
                        ? {
                            starts_at: "",
                            ends_at: "",
                            event_type: "adoption",
                            cost: "unknown",
                            cost_verified: false,
                          }
                        : null,
                  }));
                  change(
                    "category",
                    k === "celebration"
                      ? "birthday"
                      : k === "photo"
                        ? "cute"
                        : "",
                  );
                }}
              >
                <option value="spotlight">Paw of the Week submission</option>
                <option value="profile">Pet profile</option>
                <option value="photo">Photo board</option>
                <option value="celebration">Pet celebration</option>
                <option value="lost">Lost pet report</option>
                <option value="found">Found pet report</option>
                <option value="event">Organization event</option>
                <option value="adoption">
                  Shelter or rescue adoption listing
                </option>
              </select>
            </label>
          )}
          {!initial && kind !== "profile" && profiles.length > 0 && (
            <label>
              Start with one of your pets
              <select
                value={profileId || ""}
                onChange={(e) => {
                  const p = profiles.find((p) => p.id === e.target.value);
                  setProfileId(p?.id || null);
                  if (p) {
                    setContent({
                      ...p.content,
                      category: content.category,
                      source: content.source,
                      event: content.event,
                    });
                    setCommunity(p.area_id);
                  }
                }}
              >
                <option value="">Enter pet details</option>
                {profiles.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.content.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {kind === "event" ? "Event title" : "Pet name"}
            <input
              required
              maxLength={100}
              value={content.name}
              onChange={(e) => change("name", e.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            Species
            <input
              required
              maxLength={50}
              value={content.species}
              onChange={(e) => change("species", e.target.value)}
            />
          </label>
          <label>
            Home community
            <select
              required
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
            >
              <option value="">Choose a community</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {kind === "profile" && (
            <fieldset>
              <legend>A few favorite things</legend>
              <label>
                Breed or mix (optional)
                <input
                  value={content.breed}
                  maxLength={100}
                  onChange={(e) => change("breed", e.target.value)}
                />
              </label>
              <label>
                Birthday (optional)
                <input
                  type="date"
                  value={content.birthday || ""}
                  onChange={(e) => change("birthday", e.target.value || null)}
                />
              </label>
              <label>
                Adoption anniversary (optional)
                <input
                  type="date"
                  value={content.adoption_anniversary || ""}
                  onChange={(e) =>
                    change("adoption_anniversary", e.target.value || null)
                  }
                />
              </label>
              <label>
                Personality
                <input
                  maxLength={300}
                  value={content.personality}
                  onChange={(e) => change("personality", e.target.value)}
                />
              </label>
              <label>
                Favorite activities, separated by commas
                <input
                  value={content.activities.join(", ")}
                  onChange={(e) =>
                    change(
                      "activities",
                      e.target.value
                        .split(",")
                        .map((v) => v.trim())
                        .slice(0, 8),
                    )
                  }
                />
              </label>
              <label>
                Profile privacy
                <select
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as "private" | "public")
                  }
                >
                  <option value="private">Private — only me</option>
                  <option value="public">
                    Public — after editorial review
                  </option>
                </select>
              </label>
            </fieldset>
          )}
          {(kind === "photo" || kind === "celebration") && (
            <label>
              {kind === "photo" ? "Photo category" : "Celebration"}
              <select
                value={content.category}
                onChange={(e) => change("category", e.target.value)}
              >
                {(kind === "photo"
                  ? PET_PHOTO_CATEGORIES
                  : PET_CELEBRATIONS
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {["lost", "found", "celebration"].includes(kind) && (
            <label>
              {kind === "lost"
                ? "Date last seen"
                : kind === "found"
                  ? "Date found"
                  : "Celebration date (optional)"}
              <input
                required={kind !== "celebration"}
                type="date"
                value={content.date || ""}
                onChange={(e) => change("date", e.target.value || null)}
              />
            </label>
          )}
          <label>
            {kind === "profile" ? "A little biography" : "Your story"}
            <textarea
              required={kind !== "profile"}
              maxLength={4000}
              value={content.story}
              onChange={(e) => change("story", e.target.value)}
            />
          </label>
          {kind === "adoption" && (
            <label>
              Approximate age (optional)
              <input
                value={content.age_description || ""}
                maxLength={80}
                onChange={(e) => change("age_description", e.target.value)}
              />
            </label>
          )}
          {content.source && (
            <fieldset>
              <legend>Official organization and source</legend>
              <label>
                Organization name
                <input
                  required
                  maxLength={200}
                  value={content.source.organization}
                  onChange={(e) =>
                    change("source", {
                      ...content.source!,
                      organization: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Official listing or registration link
                <input
                  required
                  type="url"
                  pattern="https://.*"
                  value={content.source.official_url}
                  onChange={(e) =>
                    change("source", {
                      ...content.source!,
                      official_url: e.target.value,
                    })
                  }
                />
              </label>
              <p>
                Editors verify the organization, permission to use photographs,
                and listing information. Availability and event costs are never
                assumed.
              </p>
            </fieldset>
          )}
          {content.event && (
            <fieldset>
              <legend>Event schedule</legend>
              <p>
                Enter times in your device’s timezone (
                {deviceReady
                  ? Intl.DateTimeFormat().resolvedOptions().timeZone
                  : "your device timezone"}
                ). They display in Pacific time.
              </p>
              <label>
                Starts
                <input
                  type="datetime-local"
                  required
                  value={
                    deviceReady ? localDateTime(content.event.starts_at) : ""
                  }
                  onChange={(e) => {
                    if (e.target.value)
                      change("event", {
                        ...content.event!,
                        starts_at: new Date(e.target.value).toISOString(),
                      });
                  }}
                />
              </label>
              <label>
                Ends
                <input
                  type="datetime-local"
                  required
                  value={
                    deviceReady ? localDateTime(content.event.ends_at) : ""
                  }
                  onChange={(e) => {
                    if (e.target.value)
                      change("event", {
                        ...content.event!,
                        ends_at: new Date(e.target.value).toISOString(),
                      });
                  }}
                />
              </label>
              <label>
                Event type
                <select
                  value={content.event.event_type}
                  onChange={(e) =>
                    change("event", {
                      ...content.event!,
                      event_type: e.target.value,
                    })
                  }
                >
                  {[
                    "adoption",
                    "veterinary",
                    "vaccination",
                    "walk",
                    "festival",
                    "fundraiser",
                    "workshop",
                    "celebration",
                  ].map((type) => (
                    <option value={type} key={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reported cost
                <select
                  value={content.event.cost}
                  onChange={(e) =>
                    change("event", {
                      ...content.event!,
                      cost: e.target.value as "free" | "paid" | "unknown",
                    })
                  }
                >
                  <option value="unknown">Check with organization</option>
                  <option value="free">
                    Submitted as free — requires verification
                  </option>
                  <option value="paid">Paid registration</option>
                </select>
              </label>
            </fieldset>
          )}
          <label>
            Your public photo credit
            <input
              maxLength={100}
              value={content.attribution}
              onChange={(e) => change("attribution", e.target.value)}
              placeholder="Name you want published"
            />
          </label>
          {initial?.media.map((photo) => (
            <figure className="paw-photo" key={photo.id}>
              <img
                src={`${apiPath}/submissions/${initial.id}/media/${photo.id}`}
                alt={photo.caption || content.name}
                width={640}
                height={480}
              />
              <figcaption>{photo.attribution}</figcaption>
            </figure>
          ))}
          <label>
            Authentic photographs
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                if (
                  selected.length + (initial?.media.length || 0) > 10 ||
                  selected.some((f) => f.size > 8 * 1024 * 1024)
                ) {
                  setError(
                    "Choose up to ten JPEG, PNG or WebP photographs, each under 8 MB.",
                  );
                  return;
                }
                setError("");
                setFiles(
                  selected.map((file) => ({
                    file,
                    key: crypto.randomUUID(),
                    preview: URL.createObjectURL(file),
                  })),
                );
              }}
            />
          </label>
          <small>
            JPEG, PNG or WebP, up to 8 MB each. Photos are checked before
            publication and location metadata is removed.
          </small>
          {["lost", "found"].includes(kind) && (
            <p className="paw-safety">
              {PET_SAFETY.recovery} Private recovery contact is not available
              yet.
            </p>
          )}
        </>
      ) : (
        <>
          <article
            className={content.category === "memorial" ? "paw-memorial" : ""}
          >
            <p className="paw-context">
              {communities.find((c) => c.id === community)?.name}
            </p>
            <h2>{content.name}</h2>
            {!files.length && initial?.media[0] && (
              <figure className="paw-photo">
                <img
                  src={`${apiPath}/submissions/${initial.id}/media/${initial.media[0].id}`}
                  alt={initial.media[0].caption || content.name}
                  width={800}
                  height={600}
                />
                <figcaption>{initial.media[0].attribution}</figcaption>
              </figure>
            )}
            {files[0] && (
              <figure className="paw-photo">
                <img
                  src={files[0].preview}
                  alt={`Private preview of ${content.name}`}
                  width={800}
                  height={600}
                />
                <figcaption>{content.attribution}</figcaption>
              </figure>
            )}
            <p style={{ whiteSpace: "pre-wrap" }}>{content.story}</p>
          </article>
          <p>
            {kind === "profile" && visibility === "private"
              ? "This profile will remain private."
              : "This is a private preview. Editors will review your contribution before anyone else can see it."}
          </p>
          {needsPermission && (
            <>
              <details>
                <summary>Publication permission and guidelines</summary>
                <p>{policy.text}</p>
                <p>{policy.guidelines}</p>
              </details>
              <label className="paw-consent">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I have read and accept the publication permission. These are
                  authentic photographs I have permission to share.
                </span>
              </label>
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="paw-error">
          {error}
        </p>
      )}
      {busy && (
        <label>
          Saving your contribution
          <progress value={progress} max={files.length + 2} />
        </label>
      )}
      <div className="paw-form-actions">
        {step === 1 && (
          <button type="button" disabled={busy} onClick={() => setStep(0)}>
            Keep editing
          </button>
        )}
        <button disabled={busy} type="submit">
          {busy
            ? "Saving…"
            : step === 0
              ? "Preview your story"
              : kind === "profile" && visibility === "private"
                ? "Save private profile"
                : "Submit for editorial review"}
        </button>
      </div>
    </form>
  );
}

export function PetOwnerActions({
  resource,
  apiPath = "/api/pets",
  submitUrl = "/submit",
}: {
  resource: OwnPetResource;
  apiPath?: string;
  submitUrl?: string;
}) {
  const [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  async function act(action: "delete" | "reunited") {
    setBusy(true);
    setError("");
    try {
      await call(
        `${apiPath}/${resource.id}${action === "reunited" ? "/reunited" : ""}`,
        action === "delete" ? "DELETE" : "POST",
        { expected_revision: resource.revision },
      );
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      setBusy(false);
    }
  }
  return (
    <div className="paw-form-actions">
      <a href={`${submitUrl}?edit=${resource.id}`}>Edit details or privacy</a>
      {["lost", "found"].includes(resource.kind) && !resource.reunited_at && (
        <button disabled={busy} onClick={() => void act("reunited")}>
          Mark reunited
        </button>
      )}
      {confirm ? (
        <>
          <span>Remove this contribution and its public photographs?</span>
          <button disabled={busy} onClick={() => void act("delete")}>
            Yes, remove
          </button>
          <button disabled={busy} onClick={() => setConfirm(false)}>
            Keep it
          </button>
        </>
      ) : (
        <button disabled={busy} onClick={() => setConfirm(true)}>
          Delete
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
