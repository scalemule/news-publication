// @vitest-environment jsdom
import React from "react";
import {act} from "react";
import {cleanup, render} from "@testing-library/react";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {ReaderGreeting, READER_GREETING_POLL_MS, READER_GREETING_TIMEOUT_MS, READER_IDENTITY_CHANGED_EVENT} from "./reader-sso-client";
const reply=(name?:string)=>({ok:true,json:async()=>name?{authenticated:true,full_name:name}:{authenticated:false}});
const settle=()=>act(async()=>{await Promise.resolve();});
const changed=()=>act(()=>{document.dispatchEvent(new Event(READER_IDENTITY_CHANGED_EVENT));});
beforeEach(()=>{vi.useFakeTimers();vi.spyOn(document,"visibilityState","get").mockReturnValue("visible");});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
it("drops the previous reader when a passive poll reports remote logout",async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(reply("Bob")).mockResolvedValueOnce(reply());vi.stubGlobal("fetch",fetcher);
 const page=render(<ReaderGreeting/>);await settle();expect(page.container.textContent).toContain("Bob");
 await act(async()=>{await vi.advanceTimersByTimeAsync(READER_GREETING_POLL_MS);});
 expect(page.container.textContent).toBe("");expect(fetcher).toHaveBeenLastCalledWith("/api/news/session",expect.objectContaining({credentials:"same-origin",cache:"no-store"}));
 await act(async()=>{await vi.advanceTimersByTimeAsync(READER_GREETING_POLL_MS*3);});expect(fetcher).toHaveBeenCalledTimes(2);
});
it("clears the name immediately on the widget reset, then shows only the validated new reader",async()=>{
 let resolve!: (value: ReturnType<typeof reply>) => void;const next=new Promise<ReturnType<typeof reply>>(r=>{resolve=r});const fetcher=vi.fn().mockResolvedValueOnce(reply("Bob")).mockReturnValueOnce(next);vi.stubGlobal("fetch",fetcher);
 const page=render(<ReaderGreeting/>);await settle();changed();expect(page.container.textContent).toBe("");
 resolve(reply("Alice"));await settle();expect(page.container.textContent).toContain("Alice");expect(page.container.textContent).not.toContain("Bob");
});
it("ignores a late profile for Bob after Alice was validated",async()=>{
 let resolve!: (value: ReturnType<typeof reply>) => void;const old=new Promise<ReturnType<typeof reply>>(r=>{resolve=r});vi.stubGlobal("fetch",vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce(reply("Alice")));
 const page=render(<ReaderGreeting/>);changed();await settle();expect(page.container.textContent).toContain("Alice");resolve(reply("Bob"));await settle();expect(page.container.textContent).toContain("Alice");
});
it("clears stale names on a failed identity check",async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(reply("Bob")).mockRejectedValueOnce(Error("network"));vi.stubGlobal("fetch",fetcher);
 const page=render(<ReaderGreeting/>);await settle();await act(async()=>{await vi.advanceTimersByTimeAsync(READER_GREETING_POLL_MS);});expect(page.container.textContent).toBe("");
});
it("bounds an unavailable check and ignores its late result",async()=>{
 let resolve!: (value: ReturnType<typeof reply>) => void;vi.stubGlobal("fetch",vi.fn().mockReturnValueOnce(new Promise<ReturnType<typeof reply>>(r=>{resolve=r})));
 const page=render(<ReaderGreeting/>);await act(async()=>{await vi.advanceTimersByTimeAsync(READER_GREETING_TIMEOUT_MS);});resolve(reply("Bob"));await settle();expect(page.container.textContent).toBe("");
});
it("clears a hidden page, skips background polls, and revalidates on return",async()=>{
 const visibility=vi.spyOn(document,"visibilityState","get");const fetcher=vi.fn().mockResolvedValueOnce(reply("Bob")).mockResolvedValueOnce(reply("Alice"));vi.stubGlobal("fetch",fetcher);
 const page=render(<ReaderGreeting/>);await settle();visibility.mockReturnValue("hidden");act(()=>document.dispatchEvent(new Event("visibilitychange")));expect(page.container.textContent).toBe("");
 await act(async()=>{await vi.advanceTimersByTimeAsync(READER_GREETING_POLL_MS*2);});expect(fetcher).toHaveBeenCalledTimes(1);
 visibility.mockReturnValue("visible");act(()=>document.dispatchEvent(new Event("visibilitychange")));await settle();expect(page.container.textContent).toContain("Alice");
 page.unmount();await act(async()=>{await vi.advanceTimersByTimeAsync(READER_GREETING_POLL_MS);});expect(fetcher).toHaveBeenCalledTimes(2);
});
