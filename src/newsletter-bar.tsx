"use client";
/**
 * NewsletterBar: the publication newsletter invitation as a bottom bar, built on
 * `@scalemule/react`'s ConversionBar. One tap with Google through Ledvery
 * (consent travels with the sign-in and the callback subscribes the reader), or
 * an email address with double opt-in. It never shows to a known subscriber,
 * waits for reading intent, and brings the reader back to the story with a
 * "you're in" strip after the Google round trip.
 *
 * The bar holds no credentials: it posts to the publication's own same-origin
 * routes (`/api/news/ledvery-start`, `/api/news/email-subscribe`).
 *
 * Styles: import `@scalemule/react/conversion-bar.css` and
 * `@scalemule/news-publication/newsletter-bar.css`.
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import { ConversionBar, markConversionBarConverted, useConversionBar, type ConversionBarTrigger } from "@scalemule/react/conversion-bar";
import { LedveryButton } from "./reader-sso-client";
import { NEWSLETTER_CONFIRMED_HASH } from "./newsletter-confirmation";

export { NEWSLETTER_CONFIRMED_HASH, isPublicReadingPath, newsletterConfirmedLocation } from "./newsletter-confirmation";

export type NewsletterBarChannel = "google" | "email";
export type NewsletterBarEvent =
  | { name: "viewed" }
  | { name: "dismissed" }
  | { name: "expanded" }
  | { name: "signup_started"; channel: NewsletterBarChannel }
  | { name: "signup_failed"; channel: NewsletterBarChannel; error: string }
  | { name: "confirmation_sent"; channel: "email" }
  | { name: "confirmed"; channel: "google" };

/** Pages that already are the sign-up, an account step or a legal page. */
export const NEWSLETTER_BAR_EXCLUDED_PATHS: RegExp[] = [
  /^\/newsletter(\/|$)/, /^\/account(\/|$)/, /^\/news\/unsubscribe(\/|$)/, /^\/review(\/|$)/,
  /^\/reset-password(\/|$)/, /^\/verify-email(\/|$)/, /^\/claim(\/|$)/, /^\/api(\/|$)/,
  /^\/cookies(\/|$)/, /^\/privacy(\/|$)/, /^\/terms(\/|$)/, /^\/advertise(\/|$)/, /^\/pets\/account(\/|$)/,
];

/** Reading 35% of a story, or a little more than a screen anywhere else. */
export const NEWSLETTER_BAR_TRIGGER: ConversionBarTrigger = {
  target: "[data-conversion-target]",
  targetFraction: 0.35,
  viewportHeights: 1.2,
};

export interface NewsletterBarProps {
  publicationName: string;
  /** Storage id for dismissals; one per publication is enough. Default "newsletter". */
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  /** The publication mark shown before the title. */
  brand?: ReactNode;
  /** Current pathname (Next's `usePathname()`), so client navigation is honoured. */
  pathname?: string;
  /** Server-known reasons to stay away: a signed-in reader, a subscribed-state cookie. */
  suppressed?: boolean;
  /** A localStorage key whose value "1" marks this browser as subscribed. */
  subscribedStorageKey?: string;
  /** Offer "Continue with Google" through Ledvery. Default true. */
  googleSignIn?: boolean;
  /** Offer email-only sign-up with double opt-in. Default true. */
  emailSignUp?: boolean;
  startPath?: string;
  emailEndpoint?: string;
  policyVersion?: string;
  cadence?: "weekly" | "daily";
  /** Fine print: how often, and that it is free. Default "Free, weekly." */
  frequency?: ReactNode;
  privacyHref?: string;
  excludePaths?: RegExp[];
  trigger?: ConversionBarTrigger;
  dismissDays?: number;
  confirmation?: ReactNode;
  onEvent?(event: NewsletterBarEvent): void;
  className?: string;
}

type EmailState = { status: "idle" | "busy" | "sent"; error: string };

function readSubscribed(key: string | undefined): boolean {
  if (!key) return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function originStory(pathname: string): string | undefined {
  return pathname.startsWith("/news/") && pathname !== "/news/unsubscribe" ? pathname : undefined;
}

function readerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
}

export function NewsletterBar({
  publicationName,
  id = "newsletter",
  title,
  description,
  brand,
  pathname,
  suppressed = false,
  subscribedStorageKey,
  googleSignIn = true,
  emailSignUp = true,
  startPath = "/api/news/ledvery-start",
  emailEndpoint = "/api/news/email-subscribe",
  policyVersion = "2026-10-v1",
  cadence = "weekly",
  frequency = "Free, weekly.",
  privacyHref = "/privacy",
  excludePaths = NEWSLETTER_BAR_EXCLUDED_PATHS,
  trigger = NEWSLETTER_BAR_TRIGGER,
  dismissDays = 14,
  confirmation,
  onEvent,
  className = "",
}: NewsletterBarProps) {
  const [email, setEmail] = useState<EmailState>({ status: "idle", error: "" });
  const [path, setPath] = useState(pathname ?? "");
  useEffect(() => { setPath(pathname ?? window.location.pathname); }, [pathname]);
  if (!googleSignIn && !emailSignUp) return null;

  const emit = (event: NewsletterBarEvent) => { try { onEvent?.(event); } catch { /* analytics never breaks the bar */ } };
  const sent = email.status === "sent";
  const google = googleSignIn && !sent
    ? <LedveryButton
        provider="google"
        subscribe
        returnTo={path}
        startPath={startPath}
        classNames={{ wrapper: "sm-newsletter-bar__google", button: "sm-newsletter-bar__google-button", error: "sm-newsletter-bar__error" }}
        onStart={() => emit({ name: "signup_started", channel: "google" })}
      />
    : null;
  const form = emailSignUp && !sent
    ? <EmailForm
        endpoint={emailEndpoint}
        policyVersion={policyVersion}
        cadence={cadence}
        path={path}
        state={email}
        compact={Boolean(google)}
        onState={setEmail}
        onSent={() => { markConversionBarConverted(id); emit({ name: "confirmation_sent", channel: "email" }); }}
        onStart={() => emit({ name: "signup_started", channel: "email" })}
        onFailed={(error) => emit({ name: "signup_failed", channel: "email", error })}
      />
    : null;

  return (
    <ConversionBar
      id={id}
      className={`sm-newsletter-bar ${className}`.trim()}
      title={sent ? "Check your inbox." : title ?? <>The {publicationName} briefing</>}
      description={sent ? `Open the email we just sent to confirm your ${publicationName} subscription.` : description}
      brand={brand}
      actions={sent ? null : google ?? form}
      secondary={google ? form : null}
      fine={sent ? null : <Fine publicationName={publicationName} frequency={frequency} privacyHref={privacyHref} emailToggle={Boolean(google && form)} />}
      pathname={path || undefined}
      suppressed={suppressed}
      suppressWhen={() => readSubscribed(subscribedStorageKey)}
      excludePaths={excludePaths}
      trigger={trigger}
      dismissDays={dismissDays}
      confirmHash={NEWSLETTER_CONFIRMED_HASH}
      confirmation={confirmation ?? <>You’re in. The next {publicationName} briefing is on its way to your inbox.</>}
      dismissLabel="Close the newsletter invitation"
      onView={() => emit({ name: "viewed" })}
      onDismiss={() => emit({ name: "dismissed" })}
      onExpand={(open) => { if (open) emit({ name: "expanded" }); }}
      onConfirm={() => emit({ name: "confirmed", channel: "google" })}
    />
  );
}

function Fine({ publicationName, frequency, privacyHref, emailToggle }: { publicationName: string; frequency: ReactNode; privacyHref: string; emailToggle: boolean }) {
  const bar = useConversionBar();
  return (
    <p>
      {frequency} By subscribing you agree to receive {publicationName} emails. Unsubscribe anytime.{" "}
      <a href={privacyHref}>Privacy</a>
      {emailToggle && !bar.expanded && <>
        <span className="sm-conversion-bar__phone-only"> · </span>
        <button type="button" className="sm-conversion-bar__phone-only sm-newsletter-bar__link" onClick={() => bar.setExpanded(true)}>
          Use email instead
        </button>
      </>}
    </p>
  );
}

function EmailForm({ endpoint, policyVersion, cadence, path, state, compact, onState, onSent, onStart, onFailed }: {
  endpoint: string;
  policyVersion: string;
  cadence: "weekly" | "daily";
  path: string;
  state: EmailState;
  compact: boolean;
  onState(state: EmailState): void;
  onSent(): void;
  onStart(): void;
  onFailed(error: string): void;
}) {
  const inputId = useId();
  const errorId = useId();
  const busy = state.status === "busy";
  return (
    <form
      className={`sm-newsletter-bar__form${compact ? " sm-newsletter-bar__form--compact" : ""}`}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const address = String(data.get("email") ?? "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
          onState({ status: "idle", error: "Enter a valid email address." });
          return;
        }
        onState({ status: "busy", error: "" });
        onStart();
        try {
          const story = originStory(path);
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              email: address,
              consent: true,
              cadence,
              policy_version: policyVersion,
              timezone: readerTimeZone(),
              placement: "bar",
              ...(story ? { origin_story: story } : {}),
              website: String(data.get("website") ?? ""),
            }),
          });
          const body = await response.json().catch(() => ({})) as { error?: string };
          if (!response.ok) throw new Error(body.error || "Please try again.");
          onState({ status: "sent", error: "" });
          onSent();
        } catch (error) {
          const message = error instanceof Error && error.message ? error.message : "Please try again.";
          onState({ status: "idle", error: message });
          onFailed(message);
        }
      }}
    >
      <label className="sm-newsletter-bar__label" htmlFor={inputId}>Email address</label>
      <div className="sm-newsletter-bar__field">
        <input
          id={inputId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Your email"
          required
          disabled={busy}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
        />
        <button type="submit" disabled={busy}>{busy ? "Sending…" : "Subscribe"}</button>
      </div>
      {/* Bots fill every field; people never see this one. */}
      <input className="sm-newsletter-bar__trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {state.error && <p id={errorId} role="alert" className="sm-newsletter-bar__error">{state.error}</p>}
    </form>
  );
}
