"use client";
import React, { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

export type ConfirmationOptions = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirmation = ConfirmationOptions & { trigger: HTMLElement | null };
function ConfirmationDialog({ title, description, confirmLabel, cancelLabel = "Cancel", destructive, trigger, onDecision }: PendingConfirmation & { onDecision: (accepted: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    cancel.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      if (element?.open) element.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [trigger]);
  return <dialog ref={dialog} className="sm-confirm-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onKeyDown={event => event.stopPropagation()}
    onCancel={event => { event.preventDefault(); onDecision(false); }} onClose={event => { if (!event.currentTarget.open) onDecision(false); }}>
    <h2 id={`${id}-title`} className="sm-confirm-title">{title}</h2>
    <div id={`${id}-description`} className="sm-confirm-description">{description}</div>
    <div className="sm-confirm-actions">
      <button ref={cancel} type="button" className="sm-confirm-button sm-confirm-cancel" onClick={() => onDecision(false)}>{cancelLabel}</button>
      <button type="button" className={`sm-confirm-button sm-confirm-accept${destructive ? " sm-confirm-danger" : ""}`} onClick={() => onDecision(true)}>{confirmLabel}</button>
    </div>
  </dialog>;
}

/** Render `confirmationDialog` beside the controls and load confirmation-dialog.css. */
export function useConfirmation() {
  const [options, setOptions] = useState<PendingConfirmation | null>(null);
  const resolve = useRef<((accepted: boolean) => void) | null>(null);
  const settle = useCallback((accepted: boolean) => {
    const pending = resolve.current;
    resolve.current = null;
    setOptions(null);
    pending?.(accepted);
  }, []);
  useEffect(() => () => { resolve.current?.(false); resolve.current = null; }, []);
  const requestConfirmation = useCallback((next: ConfirmationOptions, trigger?: HTMLElement): Promise<boolean> => {
    // A repeated click cannot replace the action already being considered.
    if (resolve.current) return Promise.resolve(false);
    return new Promise(complete => { resolve.current = complete; setOptions({ ...next, trigger: trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null) }); });
  }, []);
  return { requestConfirmation, confirmationDialog: options ? <ConfirmationDialog {...options} onDecision={settle} /> : null };
}
