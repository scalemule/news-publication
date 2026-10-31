import { useState, type FormEvent } from "react";
import {
  NEIGHBOR_FLAG_REASONS,
  NEIGHBOR_NOMINEE_KINDS,
  NEIGHBOR_STORY_CATEGORIES,
  NEIGHBOR_SUBMISSION_TERMS,
  containsDisallowedLink,
  neighborCategoryPrompt,
  type NeighborStoryCategory,
} from "./neighbors";

export function NeighborNominationForm({
  towns,
  allowPhotos = false,
  endpoint = "/api/neighbors",
}: {
  towns: string[];
  allowPhotos?: boolean;
  endpoint?: string;
}) {
  const [category, setCategory] = useState<NeighborStoryCategory>("award_milestone");
  const [storyText, setStoryText] = useState("");
  const [headlineText, setHeadlineText] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null);

  const linkDetected =
    containsDisallowedLink(headlineText) || containsDisallowedLink(storyText);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (linkDetected) {
      setError("Links are not allowed. Please tell the story in your own words without URLs.");
      return;
    }
    if (!agreed) {
      setError(
        "Please agree that your submission contains no links and may be removed or moderated if needed.",
      );
      return;
    }

    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data: Record<string, unknown> = {};
    new FormData(form).forEach((value, key) => {
      if (typeof value === "string") data[key] = value;
    });
    data.agreedToTerms = agreed;

    if (allowPhotos && (data.photoCaption || data.photoCredit)) {
      data.photo = {
        caption: data.photoCaption,
        credit: data.photoCredit,
        rightsConfirmed: data.photoRightsConfirmed === "on" || data.photoRightsConfirmed === "true",
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(data),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign(`/account?next=${encodeURIComponent("/neighbors/nominate")}`);
        return;
      }
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Please check the form and try again.");
      }
      setSubmitted(body);
      form.reset();
      setStoryText("");
      setHeadlineText("");
      setAgreed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="np-market np-neighbors" role="status">
        <h2>Thank you for celebrating a neighbor.</h2>
        <p className="lead">
          Our editors received your nomination. After review, it can appear in the Neighbors feed
          or be picked up for a full feature story.
        </p>
        <p className="actions">
          <a className="primary" href="/neighbors">
            Back to Neighbors feed
          </a>
          <button
            className="secondary"
            type="button"
            onClick={() => setSubmitted(null)}
          >
            Nominate another neighbor or business
          </button>
        </p>
      </div>
    );
  }

  return (
    <form className="np-market np-neighbors form" onSubmit={submit}>
      <label>
        What kind of story is this?
        <select
          name="category"
          required
          value={category}
          onChange={event => setCategory(event.target.value as NeighborStoryCategory)}
        >
          {NEIGHBOR_STORY_CATEGORIES.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p className="meta">{neighborCategoryPrompt(category)}</p>

      <label>
        Who are you nominating?
        <select name="nomineeKind" required defaultValue="neighbor">
          {NEIGHBOR_NOMINEE_KINDS.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Name of neighbor, business, or group
        <input
          name="nomineeName"
          required
          minLength={2}
          maxLength={120}
          placeholder="e.g. Maria Chen or Oak Street Hardware"
        />
      </label>

      <label>
        Town
        <select name="town" required defaultValue="">
          <option value="" disabled>
            Choose a town
          </option>
          {towns.map(town => (
            <option key={town} value={town}>
              {town}
            </option>
          ))}
        </select>
      </label>

      <label>
        Short headline
        <input
          name="headline"
          required
          minLength={6}
          maxLength={140}
          value={headlineText}
          onChange={event => setHeadlineText(event.target.value)}
          placeholder="e.g. Won the State Science Educator Award or Celebrating 40 years on Main Street"
        />
      </label>

      <label>
        Tell us their story (no links allowed)
        <textarea
          name="story"
          required
          minLength={25}
          maxLength={2500}
          rows={7}
          value={storyText}
          onChange={event => setStoryText(event.target.value)}
          placeholder="What happened, why does it matter to the community, and what makes them worth knowing? Do not include web links."
        />
      </label>

      {linkDetected && (
        <p className="error" role="alert">
          Links and web addresses are not allowed in neighbor nominations. Please remove any URLs.
        </p>
      )}

      {allowPhotos && (
        <fieldset className="np-neighbor-photo-fieldset">
          <legend>Optional photo details</legend>
          <label>
            Photo caption
            <input
              name="photoCaption"
              maxLength={200}
              placeholder="Who is in the photo and where was it taken?"
            />
          </label>
          <label>
            Photo credit
            <input name="photoCredit" maxLength={100} placeholder="Name of photographer" />
          </label>
          <label className="np-checkbox-label">
            <input name="photoRightsConfirmed" type="checkbox" value="true" />
            <span>I took this photo or have permission for the publication to publish it.</span>
          </label>
        </fieldset>
      )}

      <label>
        Your name
        <input name="submitterName" required minLength={2} maxLength={100} />
      </label>

      <label>
        Your email (kept private for our editors)
        <input name="submitterEmail" type="email" required maxLength={254} />
      </label>

      <label>
        How can our editors reach the nominee if we pick this up for a full article? (optional, kept
        private)
        <input
          name="nomineeContact"
          maxLength={160}
          placeholder="Optional note or phone/email for editorial follow-up only (no web links)"
        />
      </label>

      <div className="np-neighbor-terms">
        <p className="meta">
          <strong>Community guidelines:</strong> {NEIGHBOR_SUBMISSION_TERMS.rules.join(" ")}
        </p>
        <label className="np-checkbox-label">
          <input
            name="agreedToTerms"
            type="checkbox"
            required
            checked={agreed}
            onChange={event => setAgreed(event.target.checked)}
          />
          <span>{NEIGHBOR_SUBMISSION_TERMS.summary}</span>
        </label>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button className="primary" type="submit" disabled={busy || linkDetected}>
        {busy ? "Submitting…" : "Submit nomination"}
      </button>
    </form>
  );
}

export function NeighborFlagForm({
  postId,
  endpoint = "/api/neighbors/flag",
}: {
  postId: string;
  endpoint?: string;
}) {
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const linkDetected = containsDisallowedLink(details);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (linkDetected) {
      setError("Links are not allowed in report notes.");
      return;
    }
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data: Record<string, string> = { postId };
    new FormData(form).forEach((value, key) => {
      if (typeof value === "string") data[key] = value;
    });
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(data),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Could not send report.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send report.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="meta" role="status">
        Thank you. Our editors have flagged this post for review and removal if needed.
      </p>
    );
  }

  return (
    <form id="flag" className="np-market np-neighbors form" onSubmit={submit}>
      <h3>Flag or request removal</h3>
      <p className="meta">
        If you are the subject of this post and want it removed, or if something here is inaccurate
        or promotional, let us know below.
      </p>
      <label>
        Reason
        <select name="reason" required defaultValue="privacy_or_consent">
          {NEIGHBOR_FLAG_REASONS.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Details (optional, no links)
        <textarea
          name="details"
          maxLength={500}
          rows={3}
          value={details}
          onChange={event => setDetails(event.target.value)}
          placeholder="Tell our editors what needs attention."
        />
      </label>
      {linkDetected && (
        <p className="error" role="alert">
          Links are not allowed in report notes.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="secondary" type="submit" disabled={busy || linkDetected}>
        {busy ? "Sending…" : "Flag post for editors"}
      </button>
    </form>
  );
}

export function NeighborFollowBar({
  towns,
  initialFollowed = [],
  onChange,
}: {
  towns: string[];
  initialFollowed?: string[];
  onChange?: (followed: string[]) => void;
}) {
  const [followed, setFollowed] = useState<string[]>(initialFollowed);

  function toggle(town: string) {
    const next = followed.includes(town)
      ? followed.filter(item => item !== town)
      : [...followed, town];
    setFollowed(next);
    onChange?.(next);
  }

  return (
    <section className="np-market np-neighbor-follow" aria-label="Follow neighborhood updates">
      <p className="meta">
        <strong>Follow your towns:</strong> Choose the neighborhoods you want in your feed.
      </p>
      <div className="filter">
        {towns.map(town => {
          const active = followed.includes(town);
          return (
            <button
              key={town}
              type="button"
              className={active ? "secondary on" : "secondary"}
              aria-pressed={active}
              onClick={() => toggle(town)}
            >
              {active ? `Following ${town}` : `Follow ${town}`}
            </button>
          );
        })}
      </div>
    </section>
  );
}
