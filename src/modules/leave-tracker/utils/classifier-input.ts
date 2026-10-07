import {
  formatIstDateTime,
  toIstDateString,
} from '../../../common/utils/date.util';

export interface ClassifierContextMessage {
  heading: string;
  text: string;
  postedAt: Date;
}

export interface ClassifierInputArgs {
  now: Date;
  postedAt: Date;
  authorName: string;
  authorUserId: string;
  text: string;
  contextMessages: ClassifierContextMessage[];
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

  for (const context of args.contextMessages)
    lines.push(
      '',
      `Context: ${context.heading} It was posted at ${describeMoment(context.postedAt)}:`,
      '"""',
      context.text,
      '"""',
    );

  return lines.join('\n');
}

function describeMoment(date: Date): string {
  return `${formatIstDateTime(date)} IST (${toIstDateString(date)})`;
}
