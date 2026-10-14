"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  PET_NOTIFICATION_CATEGORIES,
  type PetCommunity,
  type PetPreferenceRecord,
  type PetResource,
} from "./pets";

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      typeof value.error === "string" ? value.error : "Please try again.",
    );
  return value.data ?? value;
}
export function PetSignOut() {
  const [error, setError] = useState("");
  return (
    <div>
      <button
        onClick={async () => {
          try {
            await request("/api/paw-auth/logout", "POST");
            window.location.assign("/");
          } catch {
            setError("Sign-out could not be completed. Please try again.");
          }
        }}
      >
        Sign out
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function PetCommunityMemory({
  selected,
  signedIn,
}: {
  selected?: string | null;
  signedIn: boolean;
}) {
  const [error, setError] = useState("");
  useEffect(() => {
    if (selected === undefined) return;
    void request("/api/paw-community", "POST", { area_id: selected }).catch(
      () => setError("Your community could not be remembered on this device."),
    );
    if (signedIn)
      void request<PetPreferenceRecord>("/api/pets/preferences")
        .then((record) => {
          if (record.preferences.home_area_id === selected) return;
          return request("/api/pets/preferences", "PUT", {
            expected_revision: record.revision,
            preferences: { ...record.preferences, home_area_id: selected },
          });
        })
        .catch(() =>
          setError(
            "Your account preference could not be saved. You can retry from My pets.",
          ),
        );
  }, [selected, signedIn]);
  return error ? (
    <p className="paw-safety" role="status">
      {error}
    </p>
  ) : null;
}
export function PetPreferencesForm({
  record,
  communities,
  notificationsReady = false,
}: {
  record: PetPreferenceRecord;
  communities: PetCommunity[];
  notificationsReady?: boolean;
}) {
  const [value, setValue] = useState(record.preferences),
    [revision, setRevision] = useState(record.revision),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="paw-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          const result = await request<PetPreferenceRecord>(
            "/api/pets/preferences",
            "PUT",
            { expected_revision: revision, preferences: value },
          );
          setRevision(result.revision);
          setValue(result.preferences);
          setMessage("Your preferences are saved.");
          await request("/api/paw-community", "POST", {
            area_id: value.home_area_id,
          });
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Please try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Your community, your pace.</h2>
      <label>
        Home community
        <select
          value={value.home_area_id || ""}
          onChange={(e) =>
            setValue({ ...value, home_area_id: e.target.value || null })
          }
        >
          <option value="">The whole Bay Area</option>
          {communities.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Communities you follow</legend>
        {communities.map((c) => (
          <label className="paw-consent" key={c.id}>
            <input
              type="checkbox"
              checked={value.followed_area_ids.includes(c.id)}
              onChange={(e) =>
                setValue({
                  ...value,
                  followed_area_ids: e.target.checked
                    ? [...value.followed_area_ids, c.id]
                    : value.followed_area_ids.filter((id) => id !== c.id),
                })
              }
            />
            {c.name}
          </label>
        ))}
      </fieldset>
      <fieldset disabled={!notificationsReady}>
        <legend>Optional community updates</legend>
        {!notificationsReady && (
          <p>
            Community alerts are not active yet. No emails or alerts will be
            sent from these settings.
          </p>
        )}
        {PET_NOTIFICATION_CATEGORIES.map(([key, label]) => (
          <label key={key} className="paw-consent">
            <input
              type="checkbox"
              checked={value.categories.includes(key)}
              onChange={(e) =>
                setValue({
                  ...value,
                  categories: e.target.checked
                    ? [...value.categories, key]
                    : value.categories.filter((c) => c !== key),
                })
              }
            />
            {label}
          </label>
        ))}
        <label className="paw-consent">
          <input
            type="checkbox"
            checked={value.email_enabled}
            onChange={(e) =>
              setValue({ ...value, email_enabled: e.target.checked })
            }
          />
          Email me selected updates
        </label>
        <label>
          Frequency
          <select
            value={value.frequency || "weekly"}
            onChange={(e) =>
              setValue({
                ...value,
                frequency: e.target.value as "weekly" | "daily" | "immediate",
              })
            }
          >
            <option value="weekly">Weekly digest</option>
            <option value="daily">Daily digest</option>
            <option value="immediate">As updates are approved</option>
          </select>
        </label>
      </fieldset>
      <p className="paw-safety">
        Account and submission messages are separate from optional community
        updates. Sponsors never receive your profile or preferences.
      </p>
      <button disabled={busy}>Save preferences</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
export function PetResourceActions({
  resource,
  signedIn,
  apiPath = "/api/pets",
}: {
  resource: PetResource;
  signedIn: boolean;
  apiPath?: string;
}) {
  const [active, setActive] = useState(false),
    [reporting, setReporting] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const reportKey = useRef("");
  const celebrate =
    ["profile", "photo", "spotlight", "celebration"].includes(resource.kind) &&
    resource.content.category !== "memorial";
  useEffect(() => {
    if (signedIn && celebrate)
      void request<{ active: boolean }>(`${apiPath}/${resource.id}/reaction`)
        .then((v) => setActive(v.active))
        .catch(() => setMessage("Your reaction could not be loaded."));
  }, [signedIn, celebrate, resource.id, apiPath]);
  return (
    <section aria-label="Share and community care">
      <div className="paw-form-actions">
        <button
          onClick={async () => {
            try {
              if (navigator.share)
                await navigator.share({
                  title: resource.content.name,
                  url: window.location.href,
                });
              else {
                await navigator.clipboard.writeText(window.location.href);
                setMessage("Link copied.");
              }
            } catch (error) {
              if (
                !(error instanceof DOMException && error.name === "AbortError")
              )
                setMessage(
                  "You can copy the page address to share this story.",
                );
            }
          }}
        >
          Share this story
        </button>
        {celebrate && signedIn && (
          <button
            disabled={busy}
            aria-pressed={active}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await request<{ active: boolean }>(
                  `${apiPath}/${resource.id}/reaction`,
                  "PUT",
                  { active: !active },
                );
                setActive(result.active);
                setMessage(
                  result.active
                    ? "A little love, shared."
                    : "Reaction removed.",
                );
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {active ? "Loved" : "Send a little love"}
          </button>
        )}
        <button
          aria-expanded={reporting}
          onClick={() => setReporting(!reporting)}
        >
          Report a concern
        </button>
      </div>
      {reporting &&
        (signedIn ? (
          <form
            className="paw-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setBusy(true);
              try {
                if (!reportKey.current) reportKey.current = crypto.randomUUID();
                await request(`${apiPath}/${resource.id}/reports`, "POST", {
                  reason: data.get("reason"),
                  details: data.get("details"),
                  idempotency_key: reportKey.current,
                });
                setReporting(false);
                setMessage(
                  "Your private report has been sent to the editorial team.",
                );
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Concern
              <select name="reason">
                <option value="safety">Safety or recovery scam</option>
                <option value="privacy-removal">
                  Privacy or removal request
                </option>
                <option value="inappropriate-media">
                  Inappropriate photograph
                </option>
                <option value="duplicate">Duplicate notice</option>
                <option value="incorrect-information">
                  Incorrect information
                </option>
                <option value="other">Something else</option>
              </select>
            </label>
            <label>
              Tell our editors
              <textarea name="details" required maxLength={2000} />
            </label>
            <p>
              Only the editorial team can read this report. Keep contact details
              and ownership evidence out of it.
            </p>
            <button disabled={busy}>Send private report</button>
          </form>
        ) : (
          <p>
            <a
              href={
                "/account?next=" + encodeURIComponent(`/pets/${resource.id}`)
              }
            >
              Sign in to send a private report.
            </a>
          </p>
        ))}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
