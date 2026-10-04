import { useEffect, useRef, useState } from "react";

type Data = Record<string, any>;
export type Draft = { panel: string; version: number; data: Data; updated_at?: string };
type Entry = Draft & { dirty?: boolean; status?: string; local?: boolean };
const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
const same = (a: Data, b: Data) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
export const hasDraft = (data?: Data) => !!data && Object.keys(data).length > 0;

/** Server drafts are private to the capability/session and exact revision.
 * Local backup protects the last keystroke while a request is in flight. No tokens are stored here. */
export function useReviewDrafts(session: string, revision: string | undefined, initial: Record<string, Draft> | undefined,
  request: (path?: string, body?: unknown) => Promise<any>) {
  const [, render] = useState(0);
  const entries = useRef<Record<string, Entry>>({});
  const active = useRef("");
  const requester = useRef(request); requester.current = request;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const flights = useRef<Partial<Record<string, Promise<void>>>>({});
  const key = (id: string, panel: string) => `story-response:${id}:${panel}`;
  function backup(id: string, panel: string, entry: Entry) {
    try {
      if (entry.dirty) localStorage.setItem(key(id, panel), JSON.stringify({ ...entry, expires: Date.now() + 7 * 86400000 }));
      else localStorage.removeItem(key(id, panel));
      entry.local = true;
    } catch { entry.local = false; }
  }
  function redraw() { render(n => n + 1); }
  async function flush(panel: string): Promise<void> {
    clearTimeout(timers.current[panel]);
    if (flights.current[panel]) { await flights.current[panel]; if (entries.current[panel]?.dirty) return flush(panel); return; }
    const id = active.current, revisionId = revision;
    if (!revisionId) return;
    const run = async () => {
      let entry = entries.current[panel];
      while (entry?.dirty && active.current === id) {
        if (entry.status === "conflict") throw Error("Choose which response to keep before sending.");
        const sent = entry.data;
        entry.status = "saving"; redraw();
        try {
          const saved: Draft = await requester.current("", { action: "SAVE_DRAFT", revision_id: revisionId, panel, data: sent, expected_version: entry.version });
          if (active.current !== id) return;
          if (!Number.isSafeInteger(saved.version)) throw Error("Your response could not be saved yet. Please try again.");
          entry = entries.current[panel];
          entry.version = saved.version;
          entry.dirty = !same(entry.data, sent);
          entry.status = entry.dirty ? "saving" : "saved";
          backup(id, panel, entry); redraw();
        } catch (error) {
          if (active.current === id) {
            entry.status = (error as { status?: number }).status === 409 ? "conflict" : "offline";
            backup(id, panel, entry); redraw();
          }
          throw error;
        }
      }
    };
    const promise = run(); flights.current[panel] = promise;
    try { await promise; } finally { if (flights.current[panel] === promise) delete flights.current[panel]; }
  }
  const flushRef = useRef(flush); flushRef.current = flush;
  useEffect(() => {
    if (!revision) { entries.current = {}; redraw(); return; }
    const id = `${session}:${revision}`;
    active.current = id;
    const next: Record<string, Entry> = {};
    for (const panel of ["questions", "changes", "comment", "edits", "approve", "decline", "media", "metadata"]) {
      const server = initial?.[panel] || { panel, version: 0, data: {} };
      let entry: Entry = { ...server, status: "saved" };
      try {
        const raw = localStorage.getItem(key(id, panel));
        const local = raw ? JSON.parse(raw) : null;
        if (local?.dirty && local.expires > Date.now() && !same(local.data, server.data)) {
          entry = { ...local, local: true, status: local.version === server.version ? "saving" : "conflict" };
        } else localStorage.removeItem(key(id, panel));
      } catch { /* Cloud drafts remain available when browser storage is disabled. */ }
      next[panel] = entry;
    }
    entries.current = next; redraw();
    for (const [panel, entry] of Object.entries(next)) if (entry.dirty && entry.status !== "conflict") void flushRef.current(panel).catch(() => {});
    const retry = () => { for (const [panel, entry] of Object.entries(entries.current)) if (entry.dirty && entry.status !== "conflict") void flushRef.current(panel).catch(() => {}); };
    window.addEventListener("online", retry);
    const interval = setInterval(retry, 15000);
    return () => {
      active.current = "";
      Object.values(timers.current).forEach(clearTimeout);
      flights.current = {};
      window.removeEventListener("online", retry); clearInterval(interval);
    };
  }, [session, revision]);
  function set(panel: string, data: Data) {
    if (!active.current) return;
    const old = entries.current[panel] || { panel, version: 0, data: {} };
    const entry: Entry = { ...old, data, dirty: true, status: old.status === "conflict" ? "conflict" : "saving" };
    entries.current[panel] = entry;
    backup(active.current, panel, entry); redraw();
    clearTimeout(timers.current[panel]);
    if (entry.status !== "conflict") timers.current[panel] = setTimeout(() => void flushRef.current(panel).catch(() => {}), 800);
  }
  async function resolve(panel: string, keepLocal: boolean) {
    const latest = await requester.current();
    if (latest.revision.id !== revision) throw Error("The newsroom shared a new preview. Reload before continuing; your previous writing is saved separately.");
    const server: Draft = latest.response_drafts?.[panel] || { panel, version: 0, data: {} };
    const data = keepLocal ? entries.current[panel].data : server.data;
    entries.current[panel] = { ...server, data, dirty: keepLocal, status: keepLocal ? "saving" : "saved" };
    backup(active.current, panel, entries.current[panel]); redraw();
    if (keepLocal) await flush(panel);
  }
  function consumed(saved: Draft) {
    clearTimeout(timers.current[saved.panel]);
    entries.current[saved.panel] = { ...saved, dirty: false, status: "saved" };
    backup(active.current, saved.panel, entries.current[saved.panel]); redraw();
  }
  return { entries: entries.current, set, flush, resolve, consumed,
    async discard(panel: string) { set(panel, {}); await flush(panel); },
    async receipt(panel: string) {
      await flush(panel);
      const entry = entries.current[panel];
      return entry?.version ? { panel, version: entry.version } : undefined;
    },
  };
}
