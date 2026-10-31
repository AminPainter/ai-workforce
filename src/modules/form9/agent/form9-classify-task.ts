import type {
  ZohoConversationEntry,
  ZohoTicket,
} from '../../zoho/zoho.types.js';

const formatIst = (date: Date): string =>
  `${date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;

export function buildForm9ClassifyTask(
  ticket: ZohoTicket,
  conversation: ZohoConversationEntry[],
  now: Date,
): string {
  const transcript = conversation
    .map((entry) => {
      const who =
        entry.direction === 'in'
          ? 'Customer'
          : entry.direction === 'out'
            ? 'Support'
            : (entry.author ?? entry.type);
      const at = entry.createdTime
        ? ` [${formatIst(new Date(entry.createdTime))}]`
        : '';
      return `${who}${at}: ${entry.content}`;
    })
    .join('\n\n');

  const body =
    transcript ||
    (ticket.description ? `Customer: ${ticket.description}` : '') ||
    '(no conversation content available)';

  return `Current time: ${formatIst(now)}

Ticket subject: ${ticket.subject}

Conversation (oldest to newest):
${body}

Classify this ticket into an issue type (Issue Type 1 > Issue Type 2 > Issue Type 3) and judge escalation.`;
}
