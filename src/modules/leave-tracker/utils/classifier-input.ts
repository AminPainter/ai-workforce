import {
  formatIstDateTime,
  toIstDateString,
} from '../../../common/utils/date.util';
import {
  describeEntry,
  type LeaveKind,
  type LeavePortion,
} from '../constants/leave-kinds';

export interface ClassifierContextMessage {
  heading: string;
  text: string;
  postedAt: Date;
  recordedEntries: Array<{
    date: string;
    kind: LeaveKind;
    portion: LeavePortion;
  }>;
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

  for (const context of args.contextMessages) {
    lines.push(
      '',
      `Context: ${context.heading} It was posted at ${describeMoment(context.postedAt)}:`,
      '"""',
      context.text,
      '"""',
    );
    if (context.recordedEntries.length > 0)
      lines.push(
        `The leave bot already recorded from that message: ${context.recordedEntries
          .map(
            (entry) =>
              `${entry.date} ${describeEntry(entry.kind, entry.portion)}`,
          )
          .join('; ')}.`,
      );
  }
  return lines.join('\n');
}

function describeMoment(date: Date): string {
  return `${formatIstDateTime(date)} IST (${toIstDateString(date)})`;
}
