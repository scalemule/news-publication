/** Browser lifecycle for one silent attempt, after usable DOM rather than slow assets. */
type IdleTimers = Pick<Window, "setTimeout" | "clearTimeout"> & {
  requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};
export function mountReaderSsoScheduler({ document: doc, timers, eligible, attempt, idleDelayMs }: {
  document: Pick<Document, "readyState" | "addEventListener" | "removeEventListener">;
  timers: IdleTimers;
  eligible: () => boolean;
  attempt: () => void;
  idleDelayMs: number;
}): () => void {
  let active = true;
  let attempted = false;
  let idle: number | undefined;
  let delay: number | undefined;
  const cancelPending = () => {
    if (idle !== undefined) timers.cancelIdleCallback?.(idle);
    if (delay !== undefined) timers.clearTimeout(delay);
    idle = delay = undefined;
  };
  const run = () => {
    delay = undefined;
    if (!active || attempted || !eligible()) return;
    attempted = true;
    attempt();
  };
  const defer = () => {
    idle = undefined;
    if (active && !attempted) delay = timers.setTimeout(run, idleDelayMs);
  };
  const schedule = () => {
    if (!active || attempted) return;
    cancelPending();
    if (doc.readyState === "loading" || !eligible()) return;
    if (timers.requestIdleCallback) idle = timers.requestIdleCallback(defer, { timeout: 4000 });
    else defer();
  };
  doc.addEventListener("DOMContentLoaded", schedule);
  doc.addEventListener("visibilitychange", schedule);
  doc.addEventListener("prerenderingchange", schedule);
  schedule();
  return () => {
    active = false;
    cancelPending();
    doc.removeEventListener("DOMContentLoaded", schedule);
    doc.removeEventListener("visibilitychange", schedule);
    doc.removeEventListener("prerenderingchange", schedule);
  };
}
