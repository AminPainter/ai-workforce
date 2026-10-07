import { describeEntry, LEAVE_KIND_LABELS } from '../constants/leave-kinds';
import type {
  DateOutcome,
  DateOutcomeStatus,
  LeaveBotMode,
} from '../services/leave-attendance.service';
import { PAST_WINDOW_DAYS, type SkippedDate } from './leave-plan';
import { formatDateRanges, formatShortDate } from './leave-dates';

export interface LeaveReplyInput {
  mode: LeaveBotMode;
  addressee: string;
  employeeFound: boolean;
  outcomes: DateOutcome[];
  skipped: SkippedDate[];
  invalidRanges: string[];
  peoplePartnerMention: string | null;
}

export interface LeaveReply {
  text: string;
  hasProblems: boolean;
}

const SKIP_REASON_LABELS: Record<SkippedDate['reason'], string> = {
  weekend: 'weekend',
  too_far_back: `more than ${PAST_WINDOW_DAYS} days ago, please ask People to update it`,
  too_far_ahead: 'too far ahead, please post again closer to the date',
};

export function formatLeaveReply(input: LeaveReplyInput): LeaveReply {
  const escalation = input.peoplePartnerMention
    ? ` ${input.peoplePartnerMention} please check.`
    : '';

  if (!input.employeeFound)
    return {
      text: `${input.addressee} :warning: I couldn't find you in RazorpayX Payroll, so nothing was marked.${escalation}`,
      hasProblems: true,
    };

  const isShadow = input.mode === 'shadow';
  const marks = input.outcomes.filter(({ operation }) => operation === 'mark');
  const reverts = input.outcomes.filter(
    ({ operation }) => operation === 'revert',
  );
  const problems = input.outcomes.filter(({ status }) => isProblem(status));

  const lines: string[] = [];
  const pushMarkSection = (heading: string, status: DateOutcomeStatus) => {
    const section = groupMarks(marks.filter((mark) => mark.status === status));
    if (section.length > 0) lines.push(heading, ...section);
  };
  const pushRevertSection = (heading: string, status: DateOutcomeStatus) => {
    const dates = reverts
      .filter((revert) => revert.status === status)
      .map(({ date }) => date);
    if (dates.length > 0) lines.push(`${heading} ${formatDateRanges(dates)}`);
  };

  pushMarkSection(
    isShadow ? 'Would mark in RazorpayX:' : 'Marked in RazorpayX:',
    isShadow ? 'would_do' : 'done',
  );
  pushMarkSection('Already marked:', 'already_done');
  pushRevertSection(
    isShadow ? 'Would cancel:' : 'Cancelled in RazorpayX:',
    isShadow ? 'would_do' : 'done',
  );
  pushRevertSection('Nothing was marked on:', 'already_done');

  for (const revert of reverts.filter(
    ({ status }) => status === 'left_unchanged',
  ))
    lines.push(
      `Left ${formatShortDate(revert.date)} unchanged: you asked to cancel ${revert.kind ? LEAVE_KIND_LABELS[revert.kind] : 'leave'}, but ${revert.detail}.`,
    );

  const skippedByReason = new Map<SkippedDate['reason'], string[]>();
  for (const { date, reason } of input.skipped)
    skippedByReason.set(reason, [...(skippedByReason.get(reason) ?? []), date]);
  for (const [reason, dates] of skippedByReason)
    lines.push(
      `Skipped ${formatDateRanges(dates)} (${SKIP_REASON_LABELS[reason]}).`,
    );

  if (problems.length > 0 || input.invalidRanges.length > 0) {
    lines.push(`:warning: Could not update RazorpayX:`);
    for (const problem of problems)
      lines.push(
        `• ${formatShortDate(problem.date)}${problem.kind && problem.portion ? ` (${describeEntry(problem.kind, problem.portion)})` : ''}: ${problem.detail ?? problem.status}`,
      );
    if (input.invalidRanges.length > 0)
      lines.push(`• I couldn't read some of the dates in this message.`);
    if (escalation) lines.push(escalation.trim());
  }

  if (lines.length === 0)
    lines.push('Nothing to update in RazorpayX for this message.');

  return {
    text: `${input.addressee} ${lines.join('\n')}`,
    hasProblems: problems.length > 0 || input.invalidRanges.length > 0,
  };
}

function groupMarks(marks: DateOutcome[]): string[] {
  const datesByLabel = new Map<string, string[]>();
  for (const mark of marks) {
    if (!mark.kind || !mark.portion) continue;
    const label = describeEntry(mark.kind, mark.portion);
    datesByLabel.set(label, [...(datesByLabel.get(label) ?? []), mark.date]);
  }
  return [...datesByLabel].map(
    ([label, dates]) => `• ${label}: ${formatDateRanges(dates)}`,
  );
}

function isProblem(status: DateOutcomeStatus): boolean {
  return status === 'failed' || status === 'mismatch';
}
