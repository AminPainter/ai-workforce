import { describeCancelled, describeEntry } from '../constants/leave-kinds.js';
import type {
  DateOutcome,
  DateOutcomeStatus,
} from '../services/leave-attendance.service.js';
import { PAST_WINDOW_DAYS, type SkippedDate } from './leave-plan.js';
import { formatDateRanges, formatShortDate } from './leave-dates.js';

export interface LeaveReplyInput {
  addressee: string;
  employeeFound: boolean;
  outcomes: DateOutcome[];
  skipped: SkippedDate[];
  invalidRanges: string[];
  peoplePartnerMention: string;
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
  const escalation = ` ${input.peoplePartnerMention} please check.`;

  if (!input.employeeFound)
    return {
      text: `${input.addressee} :warning: I couldn't find you in RazorpayX Payroll, so nothing was marked.${escalation}`,
      hasProblems: true,
    };

  const problems = input.outcomes.filter(({ status }) => isProblem(status));

  const lines: string[] = [];
  const pushSection = (
    heading: string,
    action: DateOutcome['action'],
    status: DateOutcomeStatus,
  ) => {
    const section = groupOutcomes(
      input.outcomes.filter(
        (outcome) => outcome.action === action && outcome.status === status,
      ),
    );
    if (section.length > 0) lines.push(heading, ...section);
  };

  pushSection('Marked in RazorpayX:', 'mark', 'done');
  pushSection('Already marked:', 'mark', 'already_done');
  pushSection('Cancelled in RazorpayX:', 'cancel', 'done');
  pushSection('Nothing to cancel:', 'cancel', 'already_done');

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
        `• ${formatShortDate(problem.date)} (${describeProblem(problem)}): ${problem.detail ?? problem.status}`,
      );
    if (input.invalidRanges.length > 0)
      lines.push(`• I couldn't read some of the dates in this message.`);
    lines.push(escalation.trim());
  }

  if (lines.length === 0)
    lines.push('Nothing to update in RazorpayX for this message.');

  return {
    text: `${input.addressee} ${lines.join('\n')}`,
    hasProblems: problems.length > 0 || input.invalidRanges.length > 0,
  };
}

function groupOutcomes(outcomes: DateOutcome[]): string[] {
  const datesByLabel = new Map<string, string[]>();
  for (const outcome of outcomes) {
    const label = describeOutcome(outcome);
    datesByLabel.set(label, [...(datesByLabel.get(label) ?? []), outcome.date]);
  }
  return [...datesByLabel].map(
    ([label, dates]) => `• ${label}: ${formatDateRanges(dates)}`,
  );
}

function isProblem(status: DateOutcomeStatus): boolean {
  return status === 'failed' || status === 'mismatch';
}

function describeOutcome(outcome: DateOutcome): string {
  return outcome.action === 'mark'
    ? describeEntry(outcome.kind, outcome.portion)
    : describeCancelled(outcome.kind);
}

function describeProblem(outcome: DateOutcome): string {
  const description = describeOutcome(outcome);
  return outcome.action === 'cancel'
    ? `cancelling ${description}`
    : description;
}
