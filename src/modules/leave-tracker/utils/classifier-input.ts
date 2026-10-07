import {
  formatIstDateTime,
  toIstDateString,
} from '../../../common/utils/date.util';

export interface ThreadParentMessage {
  text: string;
  postedAt: Date;
}

export interface ClassifierInputArgs {
  now: Date;
  postedAt: Date;
  authorName: string;
  authorUserId: string;
  text: string;
  threadParent: ThreadParentMessage | null;
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

  if (args.threadParent)
    lines.push(
      '',
      `Context: this message is a reply in a thread the author started with the message below, posted at ${describeMoment(args.threadParent.postedAt)}:`,
      '"""',
      args.threadParent.text,
      '"""',
    );

  return lines.join('\n');
}

function describeMoment(date: Date): string {
  return `${formatIstDateTime(date)} IST (${toIstDateString(date)})`;
}
