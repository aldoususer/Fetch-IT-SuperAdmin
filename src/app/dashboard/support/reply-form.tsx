'use client';
import { useVerifiedRequest } from '@/components/identity-verification';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
type Props = { id: string; status: string; assignedAdminId: string | null; updatedAt: string; admins: { id: string; name: string }[] };
const statusLabel = (value: string) => value === 'IN_PROGRESS' ? 'In review' : value === 'OPEN' ? 'Open' : 'Resolved';
export function ReplyForm({ id, status: initialStatus, assignedAdminId: initialAssignee, updatedAt, admins }: Props) {
  const request = useVerifiedRequest(), router = useRouter(), pending = useRef(false);
  const [saved, setSaved] = useState({ status: initialStatus, assignedAdminId: initialAssignee ?? '', updatedAt });
  const [status, setStatus] = useState(initialStatus), [assignee, setAssignee] = useState(initialAssignee ?? '');
  const [reply, setReply] = useState(''), [replyReason, setReplyReason] = useState(''), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [review, setReview] = useState(false);
  const [feedback, setFeedback] = useState<{ intent: 'reply' | 'manage'; error: boolean; text: string } | null>(null);
  const dirty = status !== saved.status || assignee !== saved.assignedAdminId;
  async function submit(intent: 'reply' | 'manage') {
    if (pending.current) return;
    pending.current = true; setBusy(true); setFeedback(null);
    try {
      const response = await request(`/api/support/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        intent, status: intent === 'reply' ? saved.status : status, assignedAdminId: intent === 'reply' ? saved.assignedAdminId : assignee,
        reply: intent === 'reply' ? reply : '', reason: intent === 'reply' ? replyReason : reason, updatedAt: saved.updatedAt,
      }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Could not save. Your draft is kept.');
      setSaved({ status: data.ticket.status, assignedAdminId: data.ticket.assignedAdminId ?? '', updatedAt: data.ticket.updatedAt });
      if (intent === 'reply') { setReply(''); setReplyReason(''); } else { setReason(''); setReview(false); }
      setFeedback({ intent, error: false, text: intent === 'reply' ? 'Reply sent to the customer. Your reason stays internal.' : 'Assignment and status saved. No customer reply was sent.' });
      router.refresh();
    } catch (error) { setFeedback({ intent, error: true, text: error instanceof Error ? error.message : 'Could not save. Your draft is kept.' }); }
    finally { pending.current = false; setBusy(false); }
  }
  const message = (intent: 'reply' | 'manage') => feedback?.intent === intent && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'error-message' : 'success-message'}>{feedback.text}</p>;
  return <div className="support-actions">
    <section className="card conversation"><h2>Customer reply</h2><p className="muted small">Messages here are visible to the customer.</p>
      <form className="support-reply" aria-label="Customer reply" onSubmit={event => { event.preventDefault(); void submit('reply'); }}>
        <fieldset disabled={busy || saved.status === 'RESOLVED'}><label>Reply to customer<textarea className="input" required rows={5} maxLength={2000} value={reply} onChange={event => setReply(event.target.value)} /></label>
        <label>Reason for replying (internal only)<textarea className="input" required rows={2} maxLength={500} value={replyReason} onChange={event => setReplyReason(event.target.value)} /></label>
        <button className="btn btn-primary" disabled={busy || !reply.trim() || !replyReason.trim()}>Send reply</button></fieldset>
        {saved.status === 'RESOLVED' && <p className="warning-message">Reopen this request in Assignment & status before replying.</p>}{message('reply')}
      </form>
    </section>
    <section className="card conversation"><h2>Assignment & status</h2><p className="muted small">Changes are recorded under your Superadmin account.</p>
      <form className="support-reply" aria-label="Assignment and status" onSubmit={event => { event.preventDefault(); setReview(true); }}>
        <fieldset disabled={busy}><div className="support-controls"><label>Status<select className="input" value={status} onChange={event => { setStatus(event.target.value); setReview(false); }}>{['OPEN', 'IN_PROGRESS', 'RESOLVED'].map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
        <label>Assigned support staff<select className="input" value={assignee} onChange={event => { setAssignee(event.target.value); setReview(false); }}><option value="">Unassigned</option>{admins.map(admin => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select></label></div>
        <label>Reason for change (internal only)<textarea className="input" required rows={2} maxLength={500} value={reason} onChange={event => { setReason(event.target.value); setReview(false); }} /></label>
        {review ? <div className="change-review" role="region" aria-label="Review request changes"><h3>Review changes</h3><ul>
          {status !== saved.status && <li>Status: {statusLabel(saved.status)} → {statusLabel(status)}</li>}
          {assignee !== saved.assignedAdminId && <li>Assigned to: {admins.find(a => a.id === saved.assignedAdminId)?.name ?? 'Unassigned'} → {admins.find(a => a.id === assignee)?.name ?? 'Unassigned'}</li>}
        </ul><p>No customer reply will be sent.</p><div className="staff-actions"><button type="button" className="btn" onClick={() => setReview(false)}>Back to editing</button><button type="button" className="btn btn-primary" disabled={busy || !reason.trim()} onClick={() => void submit('manage')}>{busy ? 'Saving…' : 'Save assignment & status'}</button></div></div>
          : <button className="btn" disabled={busy || !dirty || !reason.trim()}>Review request changes</button>}</fieldset>{message('manage')}
      </form>
    </section>
  </div>;
}
