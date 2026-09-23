import { useState, type FormEvent } from "react";
import { CLASSIFIED_CATEGORIES, JOB_EMPLOYMENT_TYPES } from "./marketplace";

function usePost(url: string, next: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
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
        window.location.assign(`/account?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Please try again.");
      setPayload(body);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, payload, submit };
}

export function JobPostForm({ towns }: { towns: string[] }) {
  const post = usePost("/api/jobs", "/jobs/post");
  if (post.payload?.published === true) return <p role="status">Your job is on the board. Neighbors can find it on the jobs page.</p>;
  if (post.payload) return <p role="status">Thanks. We saved your job for the newsroom to review and publish.</p>;
  return (
    <form className="np-market form" onSubmit={post.submit}>
      <label>Job title<input name="title" required maxLength={120} /></label>
      <label>Employer<input name="company" required maxLength={120} /></label>
      <label>Town<select name="town" required defaultValue=""><option value="" disabled>Choose a town</option>{towns.map(town => <option key={town} value={town}>{town}</option>)}</select></label>
      <label>Type<select name="employment_type" required defaultValue="full_time">{JOB_EMPLOYMENT_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>Description<textarea name="description" required minLength={20} maxLength={4000} rows={8} /></label>
      <label>Apply email<input name="apply_email" type="email" maxLength={254} /></label>
      {post.error && <p className="error" role="alert">{post.error}</p>}
      <button className="primary" disabled={post.busy}>{post.busy ? "Saving…" : "Post job"}</button>
    </form>
  );
}

export function ClassifiedPostForm({ towns }: { towns: string[] }) {
  const post = usePost("/api/classifieds", "/classifieds/post");
  const id = typeof post.payload?.id === "string" ? post.payload.id : "";
  if (id) return <p role="status">Your listing is up. <a href={`/classifieds/${encodeURIComponent(id)}`}>View it</a>.</p>;
  return (
    <form className="np-market form" onSubmit={post.submit}>
      <label>Title<input name="title" required maxLength={120} /></label>
      <label>Category<select name="category" required defaultValue="for-sale">{CLASSIFIED_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>Town<select name="town" required defaultValue=""><option value="" disabled>Choose a town</option>{towns.map(town => <option key={town} value={town}>{town}</option>)}</select></label>
      <label>Price, optional<input name="price" type="number" min="0" step="1" /></label>
      <label>Description<textarea name="description" required minLength={20} maxLength={4000} rows={8} /></label>
      {post.error && <p className="error" role="alert">{post.error}</p>}
      <button className="primary" disabled={post.busy}>{post.busy ? "Saving…" : "Place listing"}</button>
    </form>
  );
}
