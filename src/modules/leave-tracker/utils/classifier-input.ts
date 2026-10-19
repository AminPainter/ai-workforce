import {
  formatIstDateTime,
  toIstDateString,
} from '../../../common/utils/date.util';

export enum ThreadMessageSender {
  Author = 'author',
  Other = 'other',
  Bot = 'bot',
}

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
  if (sender === ThreadMessageSender.Author) return `${name} (the author)`;
  if (sender === ThreadMessageSender.Bot) return 'Leaves bot (this system)';
  return `${name} (another person)`;
}

function describeMoment(date: Date): string {
  return `${formatIstDateTime(date)} IST (${toIstDateString(date)})`;
}
