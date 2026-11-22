"use client";
import {useVerifiedRequest} from "@/components/identity-verification";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { REVIEW_PRIORITIES, reviewLabel } from "@/lib/review-queue";

export function SupportHandoff({ ticketId, disabled = false }: { ticketId: string; disabled?: boolean }) {
  const verifiedRequest=useVerifiedRequest();
  const router = useRouter(), sending = useRef(false);
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState("");
  return <details className="section-block handoff-panel"><summary className="btn">Send to Safety Review</summary><form className="card staff-form" aria-busy={busy} onSubmit={async event => {
    event.preventDefault(); if (sending.current) return;
    const form = event.currentTarget, data = new FormData(form);
    sending.current = true; setBusy(true); setSent(false); setError("");
    try {
      const response = await verifiedRequest("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId, kind: "SAFETY", title: data.get("title"), helpReason: data.get("helpReason"), tried: data.get("tried"), priority: data.get("priority") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not send the request.");
      form.reset(); setSent(true); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send the request. Please retry."); }
    finally { sending.current = false; setBusy(false); }
  }}><h2>Send to Safety Review</h2><p>Internal handoff. The receiving staff can review the linked customer conversation and booking. This does not resolve the customer’s request.</p><fieldset disabled={busy || disabled}>
    <label>Issue title<input className="input" name="title" required maxLength={160} /></label>
    <label>Why does this need Safety Review?<textarea className="input" name="helpReason" required maxLength={1800} rows={4} /></label>
    <label>What have you already tried?<textarea className="input" name="tried" required maxLength={1800} rows={4} /></label>
    <label>How urgent is this?<select className="input" name="priority" required defaultValue=""><option value="" disabled>Choose a priority</option>{REVIEW_PRIORITIES.map(value => <option key={value} value={value}>{reviewLabel(value)}</option>)}</select></label>
  </fieldset>{disabled && <p className="warning-message">Claim this customer request before sending a handoff.</p>}{sent && <p role="status" className="success-message">Your request has been sent to Safety Review. Track updates in <a href="/dashboard/cases">Safety handoffs</a>.</p>}{error && <p role="alert" className="error-message">{error}</p>}<button className="btn btn-primary" disabled={busy || disabled}>{busy ? "Sending…" : "Send to Safety Review"}</button></form></details>;
}
