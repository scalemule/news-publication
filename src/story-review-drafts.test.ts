// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useReviewDrafts, type Draft } from "./story-review-drafts";
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function service() {
  const records: Record<string, Draft> = {};
  let offline = false;
  const request = vi.fn(async (_path?: string, command?: any) => {
    if (offline) throw Error("Offline");
    if (!command) return { revision: { id: "v1" }, response_drafts: structuredClone(records) };
    const old = records[command.panel];
    if (command.expected_version !== (old?.version || 0)) throw Object.assign(Error("Conflict"), { status: 409 });
    return records[command.panel] = { panel: command.panel, version: (old?.version || 0) + 1, data: command.data };
  });
  return { records, request, offline: (value: boolean) => { offline = value; } };
}
it("debounces Unicode writing, restores across reload, and never submits or approves by saving", async () => {
  const api = service();
  const first = renderHook(() => useReviewDrafts("session", "v1", {}, api.request));
  act(() => first.result.current.set("questions", { answers: { q1: "София 李 👩🏽‍⚕️" } }));
  expect(storage.size).toBe(1);
  await waitFor(() => expect(first.result.current.entries.questions.status).toBe("saved"), { timeout: 2000 });
  expect(api.request.mock.calls[0][1]).toMatchObject({ action: "SAVE_DRAFT", revision_id: "v1" });
  first.unmount();
  const reloaded = renderHook(() => useReviewDrafts("session", "v1", api.records, api.request));
  expect(reloaded.result.current.entries.questions.data.answers.q1).toBe("София 李 👩🏽‍⚕️");
  expect(api.request).toHaveBeenCalledTimes(1);
});
it("recovers the last unsaved keystroke after a reload while offline and retries on reconnection", async () => {
  const api = service(); api.offline(true);
  const first = renderHook(() => useReviewDrafts("session", "v1", {}, api.request));
  act(() => first.result.current.set("changes", { message: "Correct the date" }));
  first.unmount();
  const reloaded = renderHook(() => useReviewDrafts("session", "v1", {}, api.request));
  await waitFor(() => expect(reloaded.result.current.entries.changes.status).toBe("offline"));
  expect(reloaded.result.current.entries.changes.local).toBe(true);
  expect(reloaded.result.current.entries.changes.data.message).toBe("Correct the date");
  api.offline(false);
  act(() => window.dispatchEvent(new Event("online")));
  await waitFor(() => expect(reloaded.result.current.entries.changes.status).toBe("saved"));
  expect(api.records.changes.data.message).toBe("Correct the date");
});
it("does not lose typing during an in-flight save", async () => {
  let finish!: (value: Draft) => void;
  const request = vi.fn((_path?: string, body?: any): Promise<any> => request.mock.calls.length === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ panel: body.panel, data: body.data, version: 2 }));
  const hook = renderHook(() => useReviewDrafts("s", "v1", {}, request));
  act(() => hook.result.current.set("changes", { message: "First" }));
  let flush!: Promise<void>;
  act(() => { flush = hook.result.current.flush("changes"); });
  act(() => hook.result.current.set("changes", { message: "First and second" }));
  await act(async () => { finish({ panel: "changes", version: 1, data: { message: "First" } }); await flush; });
  expect(request.mock.calls[1][1]).toMatchObject({ expected_version: 1, data: { message: "First and second" } });
  expect(hook.result.current.entries.changes.status).toBe("saved");
});
it("requires a choice when another device changes a draft, preserving local writing", async () => {
  const api = service();
  const hook = renderHook(() => useReviewDrafts("s", "v1", {}, api.request));
  api.records.changes = { panel: "changes", version: 1, data: { message: "Other device" } };
  act(() => hook.result.current.set("changes", { message: "This device" }));
  await act(async () => { await expect(hook.result.current.flush("changes")).rejects.toThrow("Conflict"); });
  expect(hook.result.current.entries.changes.status).toBe("conflict");
  expect(hook.result.current.entries.changes.data.message).toBe("This device");
  expect(api.records.changes.data.message).toBe("Other device");
  await act(async () => { await hook.result.current.resolve("changes", true); });
  expect(api.records.changes.version).toBe(2);
  expect(api.records.changes.data.message).toBe("This device");
});
it("isolates revisions and clears a submitted response without resurrecting its local copy", async () => {
  const api = service();
  const hook = renderHook(({ revision }) => useReviewDrafts("s", revision, {}, api.request), { initialProps: { revision: "v1" } });
  act(() => hook.result.current.set("changes", { message: "For v1" }));
  await act(async () => { await hook.result.current.flush("changes"); });
  act(() => hook.result.current.consumed({ panel: "changes", version: 2, data: {} }));
  expect(storage.size).toBe(0);
  hook.rerender({ revision: "v2" });
  expect(hook.result.current.entries.changes.data).toEqual({});
});
