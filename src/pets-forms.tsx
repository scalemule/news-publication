"use client";
import React, {
  createContext,
  useContext,
  useId,
  useEffect,
  useRef,
  useState,
} from "react";
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
type FieldControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const FieldErrors = createContext<{
  errors: Record<string, string>;
  clear: (id: string) => void;
}>({ errors: {}, clear: () => {} });
function PetField({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const { errors, clear } = useContext(FieldErrors);
  const error = errors[id];
  const nodes = React.Children.toArray(children);
  const label = nodes
    .filter((node) => typeof node === "string")
    .join(" ")
    .trim();
  return (
    <label className={`paw-field ${className}`} htmlFor={id}>
      {nodes.map((node) => {
        if (
          !React.isValidElement<Record<string, unknown>>(node) ||
          !["input", "select", "textarea", "progress"].includes(
            String(node.type),
          )
        )
          return node;
        const original = node.props.onChange as
          | ((event: React.ChangeEvent<FieldControl>) => void)
          | undefined;
        return React.cloneElement(node, {
          id,
          "data-field-label": label,
          "aria-invalid": error ? true : undefined,
          "aria-describedby":
            [node.props["aria-describedby"], error ? `${id}-error` : undefined]
              .filter(Boolean)
              .join(" ") || undefined,
          onChange: (event: React.ChangeEvent<FieldControl>) => {
            clear(id);
            original?.(event);
          },
        });
      })}
      {error && (
        <span className="paw-field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </label>
  );
}
function fieldMessage(control: FieldControl, blank = false) {
  const label = control.dataset.fieldLabel || "this field";
  if (control.validity.valueMissing || blank) {
    if (control instanceof HTMLInputElement && control.type === "checkbox")
      return "Accept the publication permission to continue.";
    if (control instanceof HTMLInputElement && control.type === "file")
      return "Add at least one photograph of your pet.";
    if (label === "Pet name") return "Add your pet’s name.";
    if (label === "Home community") return "Choose your home community.";
    if (label === "Your story") return "Tell us a little about your pet.";
    return `Add ${label.toLowerCase()} to continue.`;
  }
  if (control.validity.typeMismatch || control.validity.patternMismatch)
    return "Enter a complete, valid link, including https://.";
  if (control.validity.rangeUnderflow || control.validity.rangeOverflow)
    return "Choose a value within the allowed range.";
  return `Check ${label.toLowerCase()} and try again.`;
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
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
    <FieldErrors.Provider
      value={{
        errors: fieldErrors,
        clear: (id) =>
          setFieldErrors((old) => {
            const next = { ...old };
            delete next[id];
            return next;
          }),
      }}
    >
      <form
        ref={formRef}
        noValidate
        className="paw-form paw-submission"
        onSubmit={(event) => {
          event.preventDefault();
          const errors: Record<string, string> = {};
          let first: FieldControl | undefined;
          for (const element of Array.from(event.currentTarget.elements)) {
            if (
              !(
                element instanceof HTMLInputElement ||
                element instanceof HTMLSelectElement ||
                element instanceof HTMLTextAreaElement
              )
            )
              continue;
            const blank =
              element.required &&
              element.type !== "checkbox" &&
              element.type !== "file" &&
              !element.value.trim();
            if (element.willValidate && (!element.validity.valid || blank)) {
              errors[element.id] = fieldMessage(element, blank);
              first ||= element;
            }
          }
          setFieldErrors(errors);
          if (first) {
            first.focus();
            return;
          }
          if (step === 0) {
            setError("");
            setStep(1);
            requestAnimationFrame(() => {
              formRef.current
                ?.querySelector("h1")
                ?.focus({ preventScroll: true });
              formRef.current?.scrollIntoView({ block: "start" });
            });
          } else void save();
        }}
      >
        <header className="paw-form-intro">
          <ol className="paw-form-steps" aria-label="Submission progress">
            <li aria-current={step === 0 ? "step" : undefined}>
              1. Their story
            </li>
            <li aria-current={step === 1 ? "step" : undefined}>
              2. Preview &amp; permission
            </li>
          </ol>
          <h1 tabIndex={-1}>
            {kind === "celebration" && content.category === "memorial"
              ? "Remember a beloved companion."
              : ["lost", "found"].includes(kind)
                ? "Help them find home."
                : step === 1
                  ? "Looking good."
                  : "Tell their story."}
          </h1>
          <p className="paw-form-description">
            {step === 0
              ? content.category === "memorial"
                ? "Share a memory of a companion you’ll always remember."
                : ["lost", "found"].includes(kind)
                  ? "A clear description and an approximate location can help neighbors recognize a missing pet."
                  : kind === "event"
                    ? "Help neighbors discover your organization’s pet community event."
                    : "A favorite photograph. A little personality. A story your neighbors will love."
              : "Take a moment to check the details. You can always go back and make changes."}
          </p>
          <p className="paw-safety">
            Choose a community, never a home address. Keep phone numbers, email
            addresses and microchip details out of your story.
          </p>
          <div className="paw-form-assurance">
            <PawMark size={28} />
            <p>
              Yours to share.
              <br />
              Reviewed with care.
            </p>
          </div>
        </header>
        <div className="paw-form-body">
          {step === 0 ? (
            <>
              {!initial && (
                <PetField>
                  What would you like to share?
                  <select
                    value={kind}
                    onChange={(e) => {
                      const k = e.target.value as PetKind;
                      setKind(k);
                      setFieldErrors({});
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
                    <option value="spotlight">
                      Paw of the Week submission
                    </option>
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
                </PetField>
              )}
              {!initial && kind !== "profile" && profiles.length > 0 && (
                <PetField>
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
                        setCommunity(
                          communities.some((c) => c.id === p.area_id)
                            ? p.area_id
                            : defaultCommunity || "",
                        );
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
                </PetField>
              )}
              <PetField>
                {kind === "event" ? "Event title" : "Pet name"}
                <input
                  required
                  maxLength={100}
                  value={content.name}
                  onChange={(e) => change("name", e.target.value)}
                  autoComplete="off"
                />
              </PetField>
              <PetField>
                Species
                <input
                  required
                  maxLength={50}
                  value={content.species}
                  onChange={(e) => change("species", e.target.value)}
                />
              </PetField>
              <PetField>
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
              </PetField>
              {kind === "profile" && (
                <fieldset>
                  <legend>A few favorite things</legend>
                  <PetField>
                    Breed or mix (optional)
                    <input
                      value={content.breed}
                      maxLength={100}
                      onChange={(e) => change("breed", e.target.value)}
                    />
                  </PetField>
                  <PetField>
                    Birthday (optional)
                    <input
                      type="date"
                      value={content.birthday || ""}
                      onChange={(e) =>
                        change("birthday", e.target.value || null)
                      }
                    />
                  </PetField>
                  <PetField>
                    Adoption anniversary (optional)
                    <input
                      type="date"
                      value={content.adoption_anniversary || ""}
                      onChange={(e) =>
                        change("adoption_anniversary", e.target.value || null)
                      }
                    />
                  </PetField>
                  <PetField>
                    Personality
                    <input
                      maxLength={300}
                      value={content.personality}
                      onChange={(e) => change("personality", e.target.value)}
                    />
                  </PetField>
                  <PetField>
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
                  </PetField>
                  <PetField>
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
                  </PetField>
                </fieldset>
              )}
              {(kind === "photo" || kind === "celebration") && (
                <PetField>
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
                </PetField>
              )}
              {["lost", "found", "celebration"].includes(kind) && (
                <PetField>
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
                </PetField>
              )}
              <PetField>
                {kind === "profile" ? "A little biography" : "Your story"}
                <textarea
                  required={kind !== "profile"}
                  maxLength={4000}
                  value={content.story}
                  onChange={(e) => change("story", e.target.value)}
                />
              </PetField>
              {kind === "adoption" && (
                <PetField>
                  Approximate age (optional)
                  <input
                    value={content.age_description || ""}
                    maxLength={80}
                    onChange={(e) => change("age_description", e.target.value)}
                  />
                </PetField>
              )}
              {content.source && (
                <fieldset>
                  <legend>Official organization and source</legend>
                  <PetField>
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
                  </PetField>
                  <PetField>
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
                  </PetField>
                  <p>
                    Editors verify the organization, permission to use
                    photographs, and listing information. Availability and event
                    costs are never assumed.
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
                  <PetField>
                    Starts
                    <input
                      type="datetime-local"
                      required
                      value={
                        deviceReady
                          ? localDateTime(content.event.starts_at)
                          : ""
                      }
                      onChange={(e) => {
                        if (e.target.value)
                          change("event", {
                            ...content.event!,
                            starts_at: new Date(e.target.value).toISOString(),
                          });
                      }}
                    />
                  </PetField>
                  <PetField>
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
                  </PetField>
                  <PetField>
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
                  </PetField>
                  <PetField>
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
                  </PetField>
                </fieldset>
              )}
              <PetField>
                Your public photo credit
                <input
                  maxLength={100}
                  value={content.attribution}
                  onChange={(e) => change("attribution", e.target.value)}
                  placeholder="Name you want published"
                />
              </PetField>
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
              <PetField className="paw-photo-picker">
                Authentic photographs
                <input
                  type="file"
                  className="paw-upload-input"
                  required={
                    ["spotlight", "photo", "adoption"].includes(kind) &&
                    !files.length &&
                    !initial?.media.length
                  }
                  aria-describedby="paw-photo-guidance"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || []);
                    if (
                      selected.length + (initial?.media.length || 0) > 10 ||
                      selected.some(
                        (f) =>
                          f.size > 8 * 1024 * 1024 ||
                          !["image/jpeg", "image/png", "image/webp"].includes(
                            f.type,
                          ),
                      )
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
                <span className="paw-upload-prompt">
                  <svg
                    viewBox="0 0 32 32"
                    width="32"
                    height="32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M11 8l2-3h6l2 3h5a3 3 0 013 3v13a3 3 0 01-3 3H6a3 3 0 01-3-3V11a3 3 0 013-3z" />
                    <circle cx="16" cy="17" r="6" />
                  </svg>
                  <strong>
                    {files.length
                      ? `${files.length} ${files.length === 1 ? "photo" : "photos"} selected`
                      : content.category === "memorial"
                        ? "A photograph to remember them by."
                        : ["lost", "found"].includes(kind)
                          ? "A clear photograph helps neighbors recognize them."
                          : "Their best angle. Their biggest personality."}
                  </strong>
                  <span>
                    {files.length
                      ? "Choose different photos"
                      : "Choose photos from your device"}
                  </span>
                </span>
              </PetField>
              <small id="paw-photo-guidance">
                JPEG, PNG or WebP, up to 8 MB each. Photos are checked before
                publication and location metadata is removed.
              </small>
              {files.length > 0 && (
                <div
                  className="paw-upload-previews"
                  aria-label="Selected photographs"
                >
                  {files.map((file) => (
                    <figure key={file.key}>
                      <img
                        src={file.preview}
                        alt={`Selected photograph: ${file.file.name}`}
                        width={160}
                        height={160}
                      />
                      <figcaption>{file.file.name}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
              {["lost", "found"].includes(kind) && (
                <p className="paw-safety">
                  {PET_SAFETY.recovery} Private recovery contact is not
                  available yet.
                </p>
              )}
            </>
          ) : (
            <>
              <article
                className={
                  content.category === "memorial" ? "paw-memorial" : ""
                }
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
                  <PetField className="paw-consent">
                    <input
                      type="checkbox"
                      required
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      I have read and accept the publication permission. These
                      are authentic photographs I have permission to share.
                    </span>
                  </PetField>
                </>
              )}
            </>
          )}
          {Object.keys(fieldErrors).length > 0 && (
            <p role="alert" className="paw-validation-summary">
              A few details need your attention. Check the fields above.
            </p>
          )}
          {error && (
            <p role="alert" className="paw-error">
              {error}
            </p>
          )}
          {busy && (
            <PetField>
              Saving your contribution
              <progress value={progress} max={files.length + 2} />
            </PetField>
          )}
          <div className="paw-form-actions">
            {step === 1 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setFieldErrors({});
                  setStep(0);
                  formRef.current?.scrollIntoView({ block: "start" });
                }}
              >
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
          <p className="paw-form-endnote">
            {step === 0
              ? "Next: a private preview. Nothing is published yet."
              : "Your contribution stays private until editorial approval."}
          </p>
        </div>
      </form>
    </FieldErrors.Provider>
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
