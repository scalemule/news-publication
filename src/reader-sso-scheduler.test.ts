// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {mountReaderSsoScheduler} from "./reader-sso-scheduler";
class Page extends EventTarget { readyState: DocumentReadyState = "interactive"; }
const cleanups: Array<() => void> = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanups.splice(0).forEach(stop => stop()); vi.useRealTimers(); });
function setup({loading=false, hidden=false, idle=false}={}) {
  const doc=new Page(); if(loading)doc.readyState="loading";
  let allowed=!hidden;let idleCallback:(() => void)|undefined;
  const attempt=vi.fn(); const cancelIdleCallback=vi.fn();
  const timers={setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window),
    ...(idle?{requestIdleCallback:vi.fn((cb:()=>void)=>{idleCallback=cb;return 7;}),cancelIdleCallback}:{})};
  const stop=mountReaderSsoScheduler({document:doc,timers,eligible:()=>allowed,attempt,idleDelayMs:1500});cleanups.push(stop);
  return{doc,attempt,stop,cancelIdleCallback,flushIdle:()=>idleCallback?.(),allow:(v:boolean)=>{allowed=v;},event:(name:string)=>doc.dispatchEvent(new Event(name))};
}
it("starts after usable DOM even when window load never arrives",()=>{
 const x=setup();vi.advanceTimersByTime(1499);expect(x.attempt).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(x.attempt).toHaveBeenCalledTimes(1);
});
it("waits for DOMContentLoaded rather than image and script completion",()=>{
 const x=setup({loading:true});vi.advanceTimersByTime(10_000);expect(x.attempt).not.toHaveBeenCalled();x.doc.readyState="interactive";x.event("DOMContentLoaded");vi.advanceTimersByTime(1500);expect(x.attempt).toHaveBeenCalledTimes(1);
});
it("resumes a hidden or prerendered page once eligible, with one attempt only",()=>{
 const x=setup({hidden:true});vi.advanceTimersByTime(10_000);expect(x.attempt).not.toHaveBeenCalled();x.allow(true);x.event("visibilitychange");x.event("prerenderingchange");vi.advanceTimersByTime(1500);expect(x.attempt).toHaveBeenCalledTimes(1);x.event("visibilitychange");vi.advanceTimersByTime(10_000);expect(x.attempt).toHaveBeenCalledTimes(1);
});
it("cancels an in-flight delay while hidden and rechecks before navigating",()=>{
 const x=setup();x.allow(false);x.event("visibilitychange");vi.advanceTimersByTime(5000);expect(x.attempt).not.toHaveBeenCalled();x.allow(true);x.event("visibilitychange");vi.advanceTimersByTime(1500);expect(x.attempt).toHaveBeenCalledTimes(1);
});
it("never navigates if eligibility changes while the reader begins typing",()=>{
 const x=setup();x.allow(false);vi.advanceTimersByTime(1500);expect(x.attempt).not.toHaveBeenCalled();
});
it("unmount cancels both idle callbacks and scheduled delays, including late callbacks",()=>{
 const x=setup({idle:true});x.stop();expect(x.cancelIdleCallback).toHaveBeenCalledWith(7);x.flushIdle();vi.advanceTimersByTime(5000);expect(x.attempt).not.toHaveBeenCalled();
 const y=setup();y.stop();vi.advanceTimersByTime(5000);expect(y.attempt).not.toHaveBeenCalled();
});
