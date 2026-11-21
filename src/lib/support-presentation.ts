type Message = { authorRole: string; body: string; createdAt: Date | string };
// Suppress only the legacy fallback, never legitimate repeated replies.
export function hasOpeningMessage(ticket: { message: string; createdAt: Date | string; messages: Message[] }) {
  return ticket.messages.some(message => message.authorRole === 'CUSTOMER'
    && message.body.trim() === ticket.message.trim()
    && new Date(message.createdAt).getTime() === new Date(ticket.createdAt).getTime());
}
export function supportSubject(message: string, category: string) {
  if (message.startsWith('URGENT SAFETY ALERT')) return 'Passenger safety alert';
  const summary = message.replace(/\s+/g, ' ').trim();
  return summary ? summary.slice(0, 100) + (summary.length > 100 ? '…' : '') : category.replaceAll('_', ' ').toLowerCase();
}
export function supportIntentError(body: { intent?: unknown; reply: string; status: string; assignedAdminId?: unknown }, ticket: { status: string; assignedAdminId: string | null }) {
  if (body.intent === undefined) return ''; // Preserve older clients.
  if (body.intent !== 'reply' && body.intent !== 'manage') return 'Choose a valid request action.';
  if (body.intent === 'manage') return body.reply.trim() ? 'Send customer replies separately from assignment and status changes.' : '';
  if (!body.reply.trim()) return 'Write a reply before sending.';
  if (body.status !== ticket.status || (body.assignedAdminId !== undefined && (body.assignedAdminId || null) !== ticket.assignedAdminId)) return 'Send the reply separately from assignment and status changes.';
  if (ticket.status === 'RESOLVED') return 'Reopen this request before sending a customer reply.';
  return '';
}
