import { useState, type FormEvent } from "react";
import { MEET_ACTIVITIES, type PublicPlace } from "./meet";

function useJson(url: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>, next?: string) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data: Record<string, string> = {};
    new FormData(form).forEach((value, key) => { if (typeof value === "string") data[key] = value; });
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(data),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign("/account?next=/meet");
        return;
      }
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Please try again.");
      if (next || body.id) window.location.assign(next || `/meet/${encodeURIComponent(String(body.id))}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
      setBusy(false);
    }
  }
  return { busy, error, submit };
}

export function MeetHostForm({ places }: { places: PublicPlace[] }) {
  const post = useJson("/api/meet");
  return (
    <form className="np-market form" onSubmit={event => post.submit(event)}>
      <label>Activity
        <select name="activity" required defaultValue="coffee">
          {MEET_ACTIVITIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label>If something else, name it<input name="otherLabel" maxLength={40} /></label>
      <label>Public place
        <select name="placeId" required defaultValue={places[0]?.id ?? ""}>
          {places.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}
        </select>
      </label>
      <label>When<input name="startsAt" type="datetime-local" required /></label>
      <label>Group size<input name="capacity" type="number" min={2} max={12} defaultValue={6} required /></label>
      <label>Note for the group<textarea name="notes" maxLength={1000} rows={4} placeholder="Where to stand, what to bring. No phone numbers." /></label>
      {post.error && <p className="error" role="alert">{post.error}</p>}
      <button className="primary" disabled={post.busy}>{post.busy ? "Saving…" : "Publish meetup"}</button>
    </form>
  );
}

export function PhoneCheckForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data: Record<string, string> = {};
    new FormData(event.currentTarget).forEach((value, key) => { if (typeof value === "string") data[key] = value; });
    const response = await fetch("/api/meet/verify-phone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ ...data, step: sent ? "check" : "send" }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(typeof body.error === "string" ? body.error : "Please try again.");
      return;
    }
    if (!sent) setSent(true);
    else window.location.reload();
  }
  return (
    <form className="np-market form" onSubmit={send}>
      <label>Mobile number<input name="phone" type="tel" autoComplete="tel" required disabled={sent} /></label>
      {sent && <label>Code from the text<input name="code" inputMode="numeric" autoComplete="one-time-code" required /></label>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{sent ? "Confirm code" : "Text me a code"}</button>
    </form>
  );
}

export function BirthdayForm() {
  const post = useJson("/api/meet/birthday");
  return (
    <form className="np-market form" onSubmit={event => post.submit(event, "/meet")}>
      <label>Date of birth<input name="bornOn" type="date" required /></label>
      <p className="meta">Meet and town chat are for adults 18 and over. Your birthday is not shown to other readers.</p>
      {post.error && <p className="error" role="alert">{post.error}</p>}
      <button className="primary" disabled={post.busy}>Continue</button>
    </form>
  );
}

export function MeetupChat({ meetupId }: { meetupId: string }) {
  const [text, setText] = useState("");
  const [lines, setLines] = useState<{ id: string; content: string; author?: string }[]>([]);
  const [error, setError] = useState("");
  async function load() {
    const response = await fetch(`/api/meet/${encodeURIComponent(meetupId)}/messages`, { credentials: "same-origin" });
    const body = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(body.messages)) setLines(body.messages);
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch(`/api/meet/${encodeURIComponent(meetupId)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ content: text }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof body.error === "string" ? body.error : "Message was not sent.");
      return;
    }
    setText("");
    await load();
  }
  return (
    <div className="np-market">
      <button className="secondary" type="button" onClick={() => void load()}>Refresh chat</button>
      <div className="list">
        {lines.map(line => <p key={line.id} className="item"><strong>{line.author || "Reader"}</strong> {line.content}</p>)}
      </div>
      <form className="form" onSubmit={send}>
        <label>Message<textarea value={text} onChange={event => setText(event.target.value)} maxLength={1000} required rows={3} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" type="submit">Send</button>
      </form>
    </div>
  );
}
