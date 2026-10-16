import {
  formatIstDateTime,
  toIstDateString,
} from '../../../common/utils/date.util';

export const THREAD_MESSAGE_SENDERS = ['author', 'other', 'bot'] as const;

export type ThreadMessageSender = (typeof THREAD_MESSAGE_SENDERS)[number];

export interface ThreadMessage {
  sender: ThreadMessageSender;
  name: string;
  text: string;
  postedAt: Date;
}

export interface ClassifierInputArgs {
  now: Date;
  postedAt: Date;
  authorName: string;
  authorUserId: string;
  text: string;
  earlierThreadMessages: ThreadMessage[];
}

export function formatClassifierInput(args: ClassifierInputArgs): string {
  const lines = [
    `Today: ${describeMoment(args.now)}.`,
    `Message posted at: ${describeMoment(args.postedAt)}.`,
    `Author: ${args.authorName} (${args.authorUserId}).`,
    '',
    'Message:',
    '"""',
    args.text,
    '"""',
  ];

  if (args.earlierThreadMessages.length > 0)
    lines.push(
      '',
      'Context: this message is a reply in a Slack thread. Earlier messages in the thread, oldest first:',
      ...args.earlierThreadMessages.flatMap((message, index) => [
        '',
        `[${index + 1}] ${describeSender(message)}, posted at ${describeMoment(message.postedAt)}:`,
        '"""',
        message.text,
        '"""',
      ]),
    );

  return lines.join('\n');
}

function describeSender({ sender, name }: ThreadMessage): string {
  if (sender === 'author') return `${name} (the author)`;
  if (sender === 'bot') return 'Leaves bot (this system)';
  return `${name} (another person)`;
}

function describeMoment(date: Date): string {
  return `${formatIstDateTime(date)} IST (${toIstDateString(date)})`;
}
