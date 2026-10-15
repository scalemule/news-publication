"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  TOY_REPORT_REASONS,
  TOY_REQUEST_STATUS_LABELS,
  TOY_SAFETY,
  formatLocalStart,
  hoursSummary,
  type OwnToyListing,
  type ToyListing,
  type ToyLocation,
  type ToyThread,
} from "./toys";
import { toyCall } from "./toys-forms";

export function ToyCommunityMemory({ selected, communityPath = "/api/toy-community" }: { selected?: string | null; communityPath?: string }) {
  const [error, setError] = useState("");
  useEffect(() => {
    if (selected === undefined) return;
    void toyCall(communityPath, "POST", { area_id: selected }).catch(() => setError("Your community could not be remembered on this device."));
  }, [selected, communityPath]);
  return error ? (
    <p className="toy-note" role="status">
      {error}
    </p>
  ) : null;
}
export function ToySignOut({ returnTo = "/", authPath = "/api/paw-auth" }: { returnTo?: string; authPath?: string }) {
  const [error, setError] = useState("");
  return (
    <span>
      <button
        className="toy-link-button"
        onClick={async () => {
          try {
            await toyCall(authPath + "/logout", "POST");
            window.location.assign(returnTo);
          } catch {
            setError("Sign-out could not be completed.");
          }
        }}
      >
        Sign out
      </button>
      {error && <span role="alert"> {error}</span>}
    </span>
  );
}
function ReportForm({ target, apiPath, onDone, reasons = TOY_REPORT_REASONS }: { target: string; apiPath: string; onDone: (message: string) => void; reasons?: typeof TOY_REPORT_REASONS }) {
  const key = useRef("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="toy-report"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true);
        try {
          if (!key.current) key.current = crypto.randomUUID();
          await toyCall(`${apiPath}/${target}/reports`, "POST", { reason: data.get("reason"), details: data.get("details"), idempotency_key: key.current });
          onDone("Your private report went to the editors.");
        } catch (e) {
          onDone(e instanceof Error ? e.message : "Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Reason
        <select name="reason">
          {reasons.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tell the editors
        <textarea name="details" required maxLength={2000} />
      </label>
      <p className="toy-note">Only editors read reports. Recall and child-safety reports hide a listing immediately pending review.</p>
      <button className="toy-button toy-button-secondary" disabled={busy}>
        Send private report
      </button>
    </form>
  );
}
/** Share, report and block on a public listing; request/offer lives in ToyRequestPanel. */
export function ToyListingActions({ listing, signedIn, apiPath = "/api/toys", accountUrl = "/account", listingPath }: { listing: ToyListing; signedIn: boolean; apiPath?: string; accountUrl?: string; listingPath: string }) {
  const [reporting, setReporting] = useState(false),
    [blocked, setBlocked] = useState<boolean | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (signedIn && listing.owner)
      void toyCall<{ active: boolean }>(`${apiPath}/profiles/${listing.owner.id}/block`)
        .then((v) => setBlocked(v.active))
        .catch(() => setBlocked(null));
  }, [signedIn, listing.owner, apiPath]);
  return (
    <section className="toy-listing-actions" aria-label="Share, report or block">
      <div className="toy-form-actions">
        <button
          className="toy-link-button"
          onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ title: listing.content.title, url: window.location.href });
              else {
                await navigator.clipboard.writeText(window.location.href);
                setMessage("Link copied.");
              }
            } catch (error) {
              if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("You can copy the page address to share this listing.");
            }
          }}
        >
          Share
        </button>
        <button className="toy-link-button" aria-expanded={reporting} onClick={() => setReporting(!reporting)}>
          Report this listing
        </button>
        {signedIn && listing.owner && blocked !== null && (
          <button
            className="toy-link-button"
            onClick={async () => {
              try {
                const result = await toyCall<{ active: boolean }>(`${apiPath}/profiles/${listing.owner!.id}/block`, "PUT", { active: !blocked });
                setBlocked(result.active);
                setMessage(result.active ? "This member is blocked. They can't request your toys or message you." : "Block removed.");
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Please try again.");
              }
            }}
          >
            {blocked ? "Unblock this member" : "Block this member"}
          </button>
        )}
      </div>
      {reporting &&
        (signedIn ? (
          <ReportForm
            target={listing.id}
            apiPath={apiPath}
            onDone={(m) => {
              setReporting(false);
              setMessage(m);
            }}
          />
        ) : (
          <p>
            <a href={accountUrl + "?next=" + encodeURIComponent(listingPath)}>Sign in to send a private report.</a>
          </p>
        ))}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
/** "Request this toy" or "Offer a swap". A giveaway never asks for anything in return. */
export function ToyRequestPanel({
  listing,
  signedIn,
  ready,
  ownListings = [],
  apiPath = "/api/toys",
  accountUrl = "/account",
  exchangeBasePath = "/exchanges",
  listingPath,
  locationsAvailable,
}: {
  listing: ToyListing;
  signedIn: boolean;
  ready: boolean;
  ownListings?: OwnToyListing[];
  apiPath?: string;
  accountUrl?: string;
  exchangeBasePath?: string;
  listingPath: string;
  locationsAvailable: boolean;
}) {
  const [open, setOpen] = useState(false),
    [offered, setOffered] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState<string>();
  const key = useRef("");
  const swap = listing.exchange_type === "swap";
  const available = ownListings.filter((l) => l.status === "available");
  if (listing.status !== "available")
    return (
      <p className="toy-note" role="status">
        This toy is currently reserved for another neighbor. If that exchange doesn't happen, it becomes available again.
      </p>
    );
  if (done)
    return (
      <p role="status" className="toy-success">
        Sent. The owner decides next. <a href={`${exchangeBasePath}/${done}`}>Open the conversation</a>.
      </p>
    );
  if (!signedIn)
    return (
      <div className="toy-request-panel">
        <a className="toy-button" href={accountUrl + "?next=" + encodeURIComponent(listingPath)}>
          {swap ? "Sign in to offer a swap" : "Sign in to request this toy"}
        </a>
        <p className="toy-note">Requesting needs an adult account with verified email and phone. Browsing never does.</p>
      </div>
    );
  if (!ready)
    return (
      <div className="toy-request-panel">
        <a className="toy-button" href={accountUrl + "?next=" + encodeURIComponent(listingPath)}>
          Finish account setup to {swap ? "offer a swap" : "request this toy"}
        </a>
        <p className="toy-note">Confirm you're 18 or older and verify your phone first. It takes a minute.</p>
      </div>
    );
  return (
    <div className="toy-request-panel">
      {!locationsAvailable && <p className="toy-note">No checked meeting places are listed for this community yet. You can send a request, but an exchange can't be scheduled until a public meeting place is added.</p>}
      {!open ? (
        <button className="toy-button" onClick={() => setOpen(true)}>
          {swap ? "Offer a swap" : "Request this toy"}
        </button>
      ) : (
        <form
          className="toy-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (!key.current) key.current = crypto.randomUUID();
              const result = await toyCall<{ id: string }>(`${apiPath}/${listing.id}/requests`, "POST", {
                kind: swap ? "swap_offer" : "request",
                offered_listing_id: swap ? offered || null : null,
                message: note,
                idempotency_key: key.current,
              });
              setDone(result.id);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {swap && (
            <label>
              Which of your available toys do you offer?
              <select required value={offered} onChange={(e) => setOffered(e.target.value)}>
                <option value="">Choose one of your listed toys</option>
                {available.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.content.title}
                  </option>
                ))}
              </select>
              {!available.length && <small>You need an approved, available listing of your own to propose a swap.</small>}
            </label>
          )}
          <label>
            A short note (optional)
            <textarea value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="When are you usually free to meet?" />
          </label>
          <p className="toy-note">{TOY_SAFETY.money}</p>
          <div className="toy-form-actions">
            <button className="toy-button toy-button-secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="toy-button" disabled={busy || (swap && !offered)}>
              {busy ? "Sending…" : swap ? "Send swap offer" : "Send request"}
            </button>
          </div>
          {error && (
            <p role="alert" className="toy-error">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
function LocationOptions({ locations }: { locations: ToyLocation[] }) {
  return (
    <>
      {locations.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name} — {hoursSummary(l.hours)}
        </option>
      ))}
    </>
  );
}
/** The private two-party thread: messages, appointment, completion, feedback, report. */
export function ToyExchangeThread({ thread, apiPath = "/api/toys", listingBasePath = "/toys", locationsUrl }: { thread: ToyThread; apiPath?: string; listingBasePath?: string; locationsUrl?: string }) {
  const [t, setT] = useState(thread),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [reporting, setReporting] = useState(false),
    [location, setLocation] = useState(thread.locations[0]?.id || ""),
    [when, setWhen] = useState("");
  const mine = t.role;
  const other = t.role === "owner" ? "requester" : "owner";
  const active = ["pending", "accepted"].includes(t.status);
  const refresh = async () => setT(await toyCall<ToyThread>(`${apiPath}/requests/${t.id}`));
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refresh();
      if (ok) setMessage(ok);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
      try {
        await refresh();
      } catch {
        /* keep the current view */
      }
    } finally {
      setBusy(false);
    }
  };
  const appointment = t.appointment;
  const waitingOnMe = appointment?.status === "proposed" && appointment.proposed_by !== mine;
  return (
    <section className="toy-thread" aria-label="Exchange conversation">
      <header className="toy-thread-header">
        <p className="toy-context">
          {t.kind === "swap_offer" ? "Swap offer" : "Request"} · {TOY_REQUEST_STATUS_LABELS[t.status] || t.status}
        </p>
        <h1>
          <a href={`${listingBasePath}/${t.listing.id}`}>{t.listing.title}</a>
          {t.offered_listing && (
            <>
              {" "}
              ⇄ <a href={`${listingBasePath}/${t.offered_listing.id}`}>{t.offered_listing.title}</a>
            </>
          )}
        </h1>
        <p>
          With {t.counterpart_deleted ? "a neighbor whose account was closed" : t.counterpart?.display_name || "a neighbor"}
          {t.counterpart && !t.counterpart_deleted && <> · {t.counterpart.completed_exchanges} completed exchange{t.counterpart.completed_exchanges === 1 ? "" : "s"} (participant-confirmed)</>}
        </p>
      </header>
      <p className="toy-safety">{t.safety}</p>
      {t.status === "pending" && mine === "owner" && (
        <div className="toy-form-actions">
          <button className="toy-button" disabled={busy} onClick={() => act(() => toyCall(`${apiPath}/requests/${t.id}/decision`, "POST", { expected_revision: t.revision, decision: "accept" }), "Accepted. The toy is reserved for this neighbor.")}>
            Accept
          </button>
          <button className="toy-button toy-button-secondary" disabled={busy} onClick={() => act(() => toyCall(`${apiPath}/requests/${t.id}/decision`, "POST", { expected_revision: t.revision, decision: "decline" }))}>
            Decline
          </button>
        </div>
      )}
      {t.status === "pending" && mine === "requester" && <p className="toy-note">Waiting for the owner to accept or decline.</p>}
      {t.status === "accepted" && (
        <section className="toy-appointment" aria-labelledby="toy-appointment-title">
          <h2 id="toy-appointment-title">Meeting</h2>
          {appointment ? (
            <div className={`toy-appointment-card toy-appointment-${appointment.status}`}>
              <p>
                <strong>{appointment.location.name}</strong>
                <br />
                {appointment.location.address}{" "}
                {appointment.location.map_url && (
                  <a href={appointment.location.map_url} rel="noopener noreferrer">
                    map
                  </a>
                )}
              </p>
              <p>
                <time dateTime={appointment.starts_at}>{formatLocalStart(appointment.local_start, appointment.timezone)}</time>
              </p>
              {appointment.location.restrictions && <p className="toy-note">{appointment.location.restrictions}</p>}
              <p className="toy-note">{appointment.status === "confirmed" ? "Confirmed by both of you." : waitingOnMe ? "Proposed by the other neighbor — confirm or propose another time." : "Waiting for the other neighbor to confirm."}</p>
              <div className="toy-form-actions">
                {waitingOnMe && (
                  <button className="toy-button" disabled={busy} onClick={() => act(() => toyCall(`${apiPath}/requests/${t.id}/appointment/confirm`, "POST", { expected_revision: t.revision, appointment_id: appointment.id }), "Confirmed.")}>
                    Confirm this time
                  </button>
                )}
                <button className="toy-link-button" disabled={busy} onClick={() => act(() => toyCall(`${apiPath}/requests/${t.id}/appointment/cancel`, "POST", { expected_revision: t.revision, appointment_id: appointment.id }))}>
                  Cancel this appointment
                </button>
              </div>
            </div>
          ) : (
            <p className="toy-note">No meeting proposed yet.</p>
          )}
          {t.locations.length ? (
            <form
              className="toy-form toy-propose"
              onSubmit={(event) => {
                event.preventDefault();
                void act(() => toyCall(`${apiPath}/requests/${t.id}/appointment`, "POST", { expected_revision: t.revision, location_id: location, local_start: when }), "Proposed. The other neighbor needs to confirm.");
              }}
            >
              <h3>{appointment ? "Propose a different time or place" : "Propose a time and place"}</h3>
              <label>
                Public meeting place
                <select required value={location} onChange={(e) => setLocation(e.target.value)}>
                  <LocationOptions locations={t.locations} />
                </select>
              </label>
              <label>
                Date and time (local to the place, daytime only)
                <input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} step={900} />
              </label>
              <p className="toy-note">
                {TOY_SAFETY.meeting} {locationsUrl && <a href={locationsUrl}>See all meeting places.</a>}
              </p>
              <button className="toy-button toy-button-secondary" disabled={busy || !location || !when}>
                Propose
              </button>
            </form>
          ) : (
            <p className="toy-note">
              No checked public meeting places are listed for this community yet, so an appointment can't be scheduled here. {locationsUrl && <a href={locationsUrl}>Suggest one for editorial review.</a>} Please don't arrange a private address instead.
            </p>
          )}
          <div className="toy-form-actions">
            <button
              className="toy-button"
              disabled={busy || (mine === "owner" ? t.owner_completed : t.requester_completed)}
              onClick={() => act(() => toyCall(`${apiPath}/requests/${t.id}/complete`, "POST", { expected_revision: t.revision }), "Marked complete.")}
            >
              {(mine === "owner" ? t.owner_completed : t.requester_completed) ? "You marked this complete" : "Mark exchange complete"}
            </button>
            <button className="toy-link-button" disabled={busy} onClick={() => act(() => toyCall(`${apiPath}/requests/${t.id}/cancel`, "POST", { expected_revision: t.revision }), "Exchange cancelled.")}>
              Cancel exchange
            </button>
          </div>
          {(t.owner_completed || t.requester_completed) && <p className="toy-note">Closes when both of you confirm completion.</p>}
        </section>
      )}
      {t.status === "pending" && (
        <div className="toy-form-actions">
          <button className="toy-link-button" disabled={busy} onClick={() => act(() => toyCall(`${apiPath}/requests/${t.id}/cancel`, "POST", { expected_revision: t.revision }), "Cancelled.")}>
            {mine === "requester" ? "Withdraw request" : "Cancel"}
          </button>
        </div>
      )}
      <section className="toy-messages" aria-label="Messages">
        <ol>
          {t.messages.map((m) => (
            <li key={m.id} className={`toy-message toy-message-${m.sender === "system" ? "system" : m.mine ? "mine" : "theirs"}`}>
              <p>{m.body}</p>
              {m.warnings.length > 0 && (
                <p className="toy-warning" role="note">
                  {m.warnings.includes("payment") && "Heads up: ToyRound never involves payments, deposits or fees. "}
                  {m.warnings.includes("verification_code") && "Never share verification codes. "}
                  {m.warnings.includes("external_link") && "Be careful with outside links. "}
                  {m.warnings.includes("contact_details") && "Keep coordination here rather than sharing phone numbers. "}
                  {m.warnings.includes("home_pickup") && "Exchanges happen only at listed public places. "}
                </p>
              )}
              <small>
                {m.sender === "system" ? "ToyRound" : m.mine ? "You" : t.counterpart?.display_name || other} · {new Date(m.created_at).toLocaleString()}
              </small>
            </li>
          ))}
        </ol>
        {active && !t.blocked ? (
          <form
            className="toy-compose"
            onSubmit={(event) => {
              event.preventDefault();
              const text = body.trim();
              if (!text) return;
              void act(async () => {
                await toyCall(`${apiPath}/requests/${t.id}/messages`, "POST", { body: text });
                setBody("");
              });
            }}
          >
            <label>
              Message
              <textarea value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
            </label>
            <button className="toy-button" disabled={busy || !body.trim()}>
              Send
            </button>
          </form>
        ) : (
          <p className="toy-note">{t.blocked ? "This conversation is closed." : "This exchange is closed."}</p>
        )}
      </section>
      {!active && t.status !== "declined" && !t.my_feedback && (
        <form
          className="toy-form toy-feedback"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void act(() => toyCall(`${apiPath}/requests/${t.id}/feedback`, "POST", { outcome: data.get("outcome"), note: data.get("note") || "" }), "Thanks. Feedback is private to the editors.");
          }}
        >
          <h2>How did it go?</h2>
          <label>
            Outcome
            <select name="outcome" defaultValue="completed">
              <option value="completed">Went fine</option>
              <option value="no_show">The other neighbor didn't show</option>
              <option value="item_mismatch">The toy didn't match the listing</option>
              <option value="harassment">I felt harassed or unsafe</option>
              <option value="other">Something else</option>
            </select>
          </label>
          <label>
            Note for the editors (optional)
            <textarea name="note" maxLength={2000} />
          </label>
          <button className="toy-button toy-button-secondary" disabled={busy}>
            Send private feedback
          </button>
        </form>
      )}
      <div className="toy-form-actions">
        <button className="toy-link-button" aria-expanded={reporting} onClick={() => setReporting(!reporting)}>
          Report this conversation
        </button>
        {t.counterpart && !t.counterpart_deleted && (
          <button className="toy-link-button" disabled={busy} onClick={() => act(() => toyCall(`${apiPath}/profiles/${t.counterpart!.id}/block`, "PUT", { active: !t.blocked }), t.blocked ? "Block removed." : "Blocked. Open exchanges with this member are closed.")}>
            {t.blocked ? "Unblock" : "Block this member"}
          </button>
        )}
      </div>
      {reporting && (
        <ReportForm
          target={`requests/${t.id}`}
          apiPath={apiPath}
          onDone={(m) => {
            setReporting(false);
            setMessage(m);
          }}
        />
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function ToyAccountDelete({ revision, apiPath = "/api/toys", returnTo = "/" }: { revision: number; apiPath?: string; returnTo?: string }) {
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="toy-delete" aria-labelledby="toy-delete-title">
      <h2 id="toy-delete-title">Delete your ToyRound account</h2>
      <p className="toy-note">Withdraws your listings, cancels open exchanges and anonymizes your profile. Reports and blocks are retained under the moderation retention policy. Your network sign-in is not affected.</p>
      {confirm ? (
        <div className="toy-form-actions">
          <button
            className="toy-button toy-button-secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await toyCall(`${apiPath}/member`, "DELETE", { expected_revision: revision });
                window.location.assign(returnTo);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Please try again.");
                setBusy(false);
              }
            }}
          >
            Yes, delete my ToyRound account
          </button>
          <button className="toy-link-button" disabled={busy} onClick={() => setConfirm(false)}>
            Keep it
          </button>
        </div>
      ) : (
        <button className="toy-link-button" onClick={() => setConfirm(true)}>
          Delete account…
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
/** "Suggest a meeting place" enters editorial review; it never becomes usable on its own. */
export function ToyLocationSuggestForm({ communities, apiPath = "/api/toys", defaultCommunity }: { communities: { id: string; name: string }[]; apiPath?: string; defaultCommunity?: string }) {
  const key = useRef("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="toy-form toy-suggest"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setMessage("");
        try {
          if (!key.current) key.current = crypto.randomUUID();
          await toyCall(`${apiPath}/locations/suggestions`, "POST", { area_id: data.get("area_id"), name: data.get("name"), address: data.get("address"), map_url: data.get("map_url") || "", note: data.get("note") || "", idempotency_key: key.current });
          setMessage("Thanks. An editor will check the place before it can be used for exchanges.");
          (event.target as HTMLFormElement).reset();
          key.current = "";
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Suggest a public meeting place</h2>
      <p className="toy-note">Libraries, police-station lobbies, community centers and busy shops with daytime hours work well. Editors verify every place against a public source before it is listed. Private homes are never accepted.</p>
      <label>
        Community
        <select name="area_id" required defaultValue={defaultCommunity || ""}>
          <option value="">Choose a community</option>
          {communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Place name
        <input name="name" required maxLength={191} />
      </label>
      <label>
        Address
        <input name="address" required maxLength={500} />
      </label>
      <label>
        Map or website link (optional, https)
        <input name="map_url" type="url" pattern="https://.*" />
      </label>
      <label>
        Why it works (optional)
        <textarea name="note" maxLength={2000} />
      </label>
      <button className="toy-button toy-button-secondary" disabled={busy}>
        Send suggestion
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
