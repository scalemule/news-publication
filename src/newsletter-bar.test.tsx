// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewsletterBar, NEWSLETTER_BAR_EXCLUDED_PATHS, type NewsletterBarEvent } from "./newsletter-bar";
import { isPublicReadingPath, newsletterConfirmedLocation } from "./newsletter-confirmation";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => { data.delete(key); },
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
  };
}

const assign = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
  window.history.replaceState(null, "", "/news/the-story");
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign, pathname: "/news/the-story", hash: "", search: "", href: "https://paper.test/news/the-story" } });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  assign.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const immediate = { immediate: true };

describe("landing after a sign-in subscription", () => {
  it("returns to public reading pages with the confirmation hash", () => {
    expect(newsletterConfirmedLocation("/news/the-story")).toBe("/news/the-story#newsletter-confirmed");
    expect(newsletterConfirmedLocation("/")).toBe("/#newsletter-confirmed");
    expect(newsletterConfirmedLocation("/sections/artificial-intelligence")).toBe("/sections/artificial-intelligence#newsletter-confirmed");
  });

  it("anything else goes to the newsletter page", () => {
    for (const path of ["", null, undefined, "/account", "/news/unsubscribe", "//evil.test/x", "/news/a?x=1", "https://evil.test/", "/meet", "/news/a/b", "/review/x"]) {
      expect(newsletterConfirmedLocation(path as string)).toBe("/newsletter?subscription=confirmed");
    }
    expect(isPublicReadingPath("/news/%D0%BD%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8")).toBe(true);
  });
});

describe("NewsletterBar", () => {
  it("offers Google and email with consent fine print", () => {
    render(<NewsletterBar publicationName="Lazy Tensor" trigger={immediate} />);
    expect(screen.getByText("The Lazy Tensor briefing")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Subscribe with Google/ })).toBeTruthy();
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    expect(screen.getByText(/By subscribing you agree to receive Lazy Tensor emails/)).toBeTruthy();
    // The Google button carries what it does for screen readers, including the reader account.
    expect(screen.getByRole("button", { name: /Subscribe with Google/ }).getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText(/Creates or signs in to your free Lazy Tensor reader account/)).toBeTruthy();
    expect(screen.getByText(/with Google you also get a free reader account/)).toBeTruthy();
  });

  it("Google starts a subscribing Ledvery sign-in that returns to the story", async () => {
    const events: NewsletterBarEvent[] = [];
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ url: "https://api.ledvery.com/authorize?x=1" }) });
    render(<NewsletterBar publicationName="Lazy Tensor" pathname="/news/the-story" trigger={immediate} onEvent={(e) => events.push(e)} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Subscribe with Google/ })); });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/news/ledvery-start");
    expect(JSON.parse(init.body)).toEqual({ provider: "google", subscribe: true, consent: true, returnTo: "/news/the-story" });
    expect(assign).toHaveBeenCalledWith("https://api.ledvery.com/authorize?x=1");
    expect(events).toContainEqual({ name: "signup_started", channel: "google" });
  });

  it("email sign-up posts consent with placement and story, then asks the reader to confirm", async () => {
    const events: NewsletterBarEvent[] = [];
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ confirmation_required: true }) });
    render(<NewsletterBar publicationName="Lazy Tensor" pathname="/news/the-story" trigger={immediate} onEvent={(e) => events.push(e)} />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Subscribe" })); });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/news/email-subscribe");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ email: "reader@example.com", consent: true, cadence: "weekly", placement: "bar", origin_story: "/news/the-story", website: "" });
    expect(screen.getByText("Check your inbox.")).toBeTruthy();
    expect(screen.queryByLabelText("Email address")).toBeNull();
    expect(events).toContainEqual({ name: "confirmation_sent", channel: "email" });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close the newsletter invitation");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 80)); });
    expect(screen.getByRole("status").textContent).toContain("Open the email we just sent");
    // The next page view does not ask again for a while (not converted until confirmed).
    cleanup();
    render(<NewsletterBar publicationName="Lazy Tensor" trigger={immediate} />);
    expect(screen.queryByText("The Lazy Tensor briefing")).toBeNull();
  });

  it("rejects an invalid address without a request and reports server errors", async () => {
    const events: NewsletterBarEvent[] = [];
    render(<NewsletterBar publicationName="Lazy Tensor" googleSignIn={false} trigger={immediate} onEvent={(e) => events.push(e)} />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "not-an-email" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Subscribe" })); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid email address.");
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Please agree to receive Lazy Tensor email updates." }) });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Subscribe" })); });
    expect(screen.getByRole("alert").textContent).toBe("Please agree to receive Lazy Tensor email updates.");
    expect(events).toContainEqual({ name: "signup_failed", channel: "email", error: "Please agree to receive Lazy Tensor email updates." });
  });

  it("stays away from subscribers, suppressed readers and sign-up pages", () => {
    window.localStorage.setItem("paper_subscribed", "1");
    render(<NewsletterBar publicationName="Lazy Tensor" subscribedStorageKey="paper_subscribed" trigger={immediate} />);
    expect(screen.queryByText("The Lazy Tensor briefing")).toBeNull();
    cleanup();
    render(<NewsletterBar publicationName="Lazy Tensor" suppressed trigger={immediate} />);
    expect(screen.queryByText("The Lazy Tensor briefing")).toBeNull();
    cleanup();
    render(<NewsletterBar publicationName="Lazy Tensor" pathname="/newsletter" trigger={immediate} />);
    expect(screen.queryByText("The Lazy Tensor briefing")).toBeNull();
    for (const path of ["/account", "/newsletter/preferences", "/news/unsubscribe", "/privacy"]) {
      expect(NEWSLETTER_BAR_EXCLUDED_PATHS.some((rule) => rule.test(path))).toBe(true);
    }
    expect(NEWSLETTER_BAR_EXCLUDED_PATHS.some((rule) => rule.test("/news/the-story"))).toBe(false);
  });

  it("'Or sign up with email' sits under the Google button and opens the email form on a phone", async () => {
    const events: NewsletterBarEvent[] = [];
    render(<NewsletterBar publicationName="Lazy Tensor" trigger={immediate} onEvent={(e) => events.push(e)} />);
    const choice = screen.getByRole("button", { name: "Or sign up with email" });
    // Directly under the Google button, not inside the fine print.
    expect(choice.closest(".sm-newsletter-bar__primary")?.querySelector(".sm-newsletter-bar__google-button")).toBeTruthy();
    expect(choice.closest(".sm-conversion-bar__fine")).toBeNull();
    fireEvent.click(choice);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(document.activeElement).toBe(screen.getByLabelText("Email address"));
    expect(document.querySelector(".sm-conversion-bar")?.getAttribute("data-expanded")).toBe("true");
    expect(screen.queryByRole("button", { name: "Or sign up with email" })).toBeNull();
    expect(events).toContainEqual({ name: "expanded" });
  });

  it("shows 'you're in' only when the server confirmed the subscription", () => {
    window.location.hash = "#newsletter-confirmed";
    render(<NewsletterBar publicationName="Lazy Tensor" trigger={immediate} />);
    expect(screen.queryByText(/You’re in/)).toBeNull();
    cleanup();
    window.location.hash = "#newsletter-confirmed";
    render(<NewsletterBar publicationName="Lazy Tensor" confirmed suppressed trigger={immediate} />);
    expect(screen.getByText(/You’re in/)).toBeTruthy();
  });

  it("speaks the site's language and can send the email through the site's own route", async () => {
    const submitEmail = vi.fn().mockResolvedValue(undefined);
    render(<NewsletterBar
      publicationName="Българско"
      googleSignIn={false}
      frequency="Безплатно, седмично."
      labels={{
        title: (name) => <>Бюлетинът на {name}</>,
        emailLabel: "Имейл адрес",
        emailPlaceholder: "Вашият имейл",
        emailSubmit: "Абонирай ме",
        consent: (name) => `Съгласявате се да получавате имейли от ${name}.`,
        sentTitle: "Проверете пощата си.",
        sentMessage: () => "Изпратихме връзка за потвърждение.",
        dismiss: "Затвори",
      }}
      submitEmail={submitEmail}
      pathname="/news/история"
      trigger={immediate}
    />);
    expect(screen.getByText("Бюлетинът на Българско")).toBeTruthy();
    expect(screen.getByText(/Съгласявате се да получавате имейли от Българско/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Имейл адрес"), { target: { value: "reader@example.com" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Абонирай ме" })); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(submitEmail).toHaveBeenCalledWith(expect.objectContaining({ email: "reader@example.com", placement: "bar", cadence: "weekly", website: "", originStory: "/news/история" }));
    expect(screen.getByText("Проверете пощата си.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Затвори" })).toBeTruthy();
  });

  it("a custom submit's error is shown to the reader", async () => {
    render(<NewsletterBar publicationName="Paper" googleSignIn={false} submitEmail={async () => { throw new Error("Опитайте отново."); }} trigger={immediate} />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Subscribe" })); });
    expect(screen.getByRole("alert").textContent).toBe("Опитайте отново.");
  });

  it("dismissal is reported", () => {
    const events: NewsletterBarEvent[] = [];
    render(<NewsletterBar publicationName="Lazy Tensor" trigger={immediate} onEvent={(e) => events.push(e)} />);
    expect(events).toContainEqual({ name: "viewed" });
    fireEvent.click(screen.getByRole("button", { name: "Close the newsletter invitation" }));
    expect(events).toContainEqual({ name: "dismissed" });
    expect(screen.queryByText("The Lazy Tensor briefing")).toBeNull();
  });
});
