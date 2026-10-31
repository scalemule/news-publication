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
import { ConversionBar, markConversionBarDismissed, useConversionBar, type ConversionBarTrigger } from "@scalemule/react/conversion-bar";
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

/** Every visible and announced string, so a site can speak its readers' language. */
export interface NewsletterBarLabels {
  title(publicationName: string): ReactNode;
  googleButton: string;
  googleBusy: string;
  /** Read to screen-reader users with the Google button. */
  googleDescription(publicationName: string): string;
  emailLabel: string;
  emailPlaceholder: string;
  emailSubmit: string;
  emailBusy: string;
  invalidEmail: string;
  tryAgain: string;
  /** Fine print after the frequency: the consent sentence. */
  consent(publicationName: string, withGoogle: boolean): ReactNode;
  privacy: string;
  /** @deprecated Kept for compatibility; the phone email choice now uses `emailToggle`. */
  useEmailInstead: string;
  /** Phone: the line under the Google button that opens the email field. */
  emailToggle: string;
  sentTitle: string;
  sentMessage(publicationName: string): string;
  confirmation(publicationName: string): ReactNode;
  dismiss: string;
}

export const NEWSLETTER_BAR_LABELS_EN: NewsletterBarLabels = {
  title: (name) => <>The {name} briefing</>,
  googleButton: "Subscribe with Google",
  googleBusy: "Opening Google…",
  googleDescription: (name) => `Creates or signs in to your free ${name} reader account and subscribes you to ${name} emails. Unsubscribe anytime.`,
  emailLabel: "Email address",
  emailPlaceholder: "Your email",
  emailSubmit: "Subscribe",
  emailBusy: "Sending…",
  invalidEmail: "Enter a valid email address.",
  tryAgain: "Please try again.",
  consent: (name, withGoogle) => `By subscribing you agree to receive ${name} emails${withGoogle ? "; with Google you also get a free reader account" : ""}. Unsubscribe anytime.`,
  privacy: "Privacy",
  useEmailInstead: "Use email instead",
  emailToggle: "Or sign up with email",
  sentTitle: "Check your inbox.",
  sentMessage: (name) => `Open the email we just sent to confirm your ${name} subscription.`,
  confirmation: (name) => <>You’re in. The next {name} briefing is on its way to your inbox.</>,
  dismiss: "Close the newsletter invitation",
};

/** What the bar hands to a site's own sign-up route when `submitEmail` replaces the default request. */
export interface NewsletterBarEmailRequest {
  email: string;
  cadence: "weekly" | "daily";
  policyVersion: string;
  timezone: string;
  placement: "bar";
  originStory?: string;
  /** The honeypot field; non-empty means a bot. */
  website: string;
}

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
  /**
   * The server knows this browser just subscribed (a signed subscribed-state cookie). Required
   * before `#newsletter-confirmed` shows "you're in"; a bare hash is ignored.
   */
  confirmed?: boolean;
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
  /** Replace any of the English strings. */
  labels?: Partial<NewsletterBarLabels>;
  /**
   * Send the email sign-up yourself (a site with its own route or payload). Throw an Error whose
   * message is shown to the reader. Default: POST JSON to `emailEndpoint`.
   */
  submitEmail?(request: NewsletterBarEmailRequest): Promise<void>;
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
  confirmed = false,
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
  labels: labelOverrides,
  submitEmail,
  onEvent,
  className = "",
}: NewsletterBarProps) {
  const labels: NewsletterBarLabels = { ...NEWSLETTER_BAR_LABELS_EN, ...labelOverrides };
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
        label={labels.googleButton}
        busyLabel={labels.googleBusy}
        description={labels.googleDescription(publicationName)}
        returnTo={path}
        startPath={startPath}
        classNames={{ wrapper: "sm-newsletter-bar__google", button: "sm-newsletter-bar__google-button", fine: "sm-conversion-bar__sr", error: "sm-newsletter-bar__error" }}
        onStart={() => emit({ name: "signup_started", channel: "google" })}
      />
    : null;
  const form = emailSignUp && !sent
    ? <EmailForm
        labels={labels}
        submit={submitEmail ?? ((request) => postEmail(emailEndpoint, request, labels.tryAgain))}
        policyVersion={policyVersion}
        cadence={cadence}
        path={path}
        state={email}
        compact={Boolean(google)}
        onState={setEmail}
        // Not converted until the reader confirms; the confirmed form sets the subscribed marker.
        onSent={() => { markConversionBarDismissed(id); emit({ name: "confirmation_sent", channel: "email" }); }}
        onStart={() => emit({ name: "signup_started", channel: "email" })}
        onFailed={(error) => emit({ name: "signup_failed", channel: "email", error })}
      />
    : null;

  return (
    <ConversionBar
      id={id}
      className={`sm-newsletter-bar ${className}`.trim()}
      title={sent ? labels.sentTitle : title ?? labels.title(publicationName)}
      description={sent ? undefined : description}
      brand={brand}
      actions={sent ? null : google ? <div className="sm-newsletter-bar__primary">{google}{form && <EmailChoice label={labels.emailToggle} />}</div> : form}
      secondary={google ? form : null}
      fine={sent
        ? <Sent message={labels.sentMessage(publicationName)} />
        : <Fine labels={labels} publicationName={publicationName} frequency={frequency} privacyHref={privacyHref} google={Boolean(google)} />}
      pathname={path || undefined}
      suppressed={suppressed}
      suppressWhen={() => readSubscribed(subscribedStorageKey)}
      excludePaths={excludePaths}
      trigger={trigger}
      dismissDays={dismissDays}
      confirmHash={NEWSLETTER_CONFIRMED_HASH}
      confirmationVerified={confirmed}
      confirmation={confirmation ?? labels.confirmation(publicationName)}
      dismissLabel={labels.dismiss}
      onView={() => emit({ name: "viewed" })}
      onDismiss={() => emit({ name: "dismissed" })}
      onExpand={(open) => { if (open) emit({ name: "expanded" }); }}
      onConfirm={() => emit({ name: "confirmed", channel: "google" })}
    />
  );
}

/** Announces the next step and keeps keyboard focus inside the bar after the form goes away. */
function Sent({ message }: { message: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setText(message), 60);
    document.querySelector<HTMLElement>(".sm-newsletter-bar .sm-conversion-bar__dismiss")?.focus();
    return () => window.clearTimeout(timer);
  }, [message]);
  return <>
    <p aria-hidden="true">{message}</p>
    <p className="sm-conversion-bar__sr" role="status">{text}</p>
  </>;
}

/** Phone only: a clear second choice right under the Google button; opens the email field and focuses it. */
function EmailChoice({ label }: { label: string }) {
  const bar = useConversionBar();
  if (bar.expanded) return null;
  return (
    <button type="button" className="sm-conversion-bar__phone-only sm-newsletter-bar__email-choice" onClick={() => {
      bar.setExpanded(true);
      // The choice goes away; focus the field it revealed.
      window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".sm-newsletter-bar .sm-newsletter-bar__input")?.focus());
    }}>
      {label}
    </button>
  );
}

function Fine({ labels, publicationName, frequency, privacyHref, google }: { labels: NewsletterBarLabels; publicationName: string; frequency: ReactNode; privacyHref: string; google: boolean }) {
  return (
    <p>
      {frequency} {labels.consent(publicationName, google)}{" "}
      <a href={privacyHref}>{labels.privacy}</a>
    </p>
  );
}

async function postEmail(endpoint: string, request: NewsletterBarEmailRequest, fallback: string): Promise<void> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      email: request.email,
      consent: true,
      cadence: request.cadence,
      policy_version: request.policyVersion,
      timezone: request.timezone,
      placement: request.placement,
      ...(request.originStory ? { origin_story: request.originStory } : {}),
      website: request.website,
    }),
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || fallback);
}

function EmailForm({ labels, submit, policyVersion, cadence, path, state, compact, onState, onSent, onStart, onFailed }: {
  labels: NewsletterBarLabels;
  submit(request: NewsletterBarEmailRequest): Promise<void>;
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
          onState({ status: "idle", error: labels.invalidEmail });
          return;
        }
        onState({ status: "busy", error: "" });
        onStart();
        try {
          await submit({
            email: address,
            cadence,
            policyVersion,
            timezone: readerTimeZone(),
            placement: "bar",
            originStory: originStory(path),
            website: String(data.get("website") ?? ""),
          });
          onState({ status: "sent", error: "" });
          onSent();
        } catch (error) {
          const message = error instanceof Error && error.message ? error.message : labels.tryAgain;
          onState({ status: "idle", error: message });
          onFailed(message);
        }
      }}
    >
      <label className="sm-newsletter-bar__label" htmlFor={inputId}>{labels.emailLabel}</label>
      <div className="sm-newsletter-bar__field">
        <input
          id={inputId}
          className="sm-newsletter-bar__input"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={labels.emailPlaceholder}
          required
          disabled={busy}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
        />
        <button type="submit" disabled={busy}>{busy ? labels.emailBusy : labels.emailSubmit}</button>
      </div>
      {/* Bots fill every field; people never see this one. */}
      <input className="sm-newsletter-bar__trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {state.error && <p id={errorId} role="alert" className="sm-newsletter-bar__error">{state.error}</p>}
    </form>
  );
}
