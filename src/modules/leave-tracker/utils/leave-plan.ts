import type { LeaveRequestClassification } from '../agents/leave-request-classifier.schema';
import type { LeaveKind, LeavePortion } from '../constants/leave-kinds';
import {
  addDays,
  expandDateRange,
  isValidDateString,
  isWeekend,
} from './leave-dates';

const MAX_DAYS_PER_RANGE = 120;
export const PAST_WINDOW_DAYS = 7;
export const FUTURE_WINDOW_DAYS = 180;

export interface PlannedMark {
  date: string;
  kind: LeaveKind;
  portion: LeavePortion;
}

export interface PlannedRevert {
  date: string;
  kind: LeaveKind | null;
}

export interface SkippedDate {
  date: string;
  reason: 'weekend' | 'too_far_back' | 'too_far_ahead';
}

export interface LeavePlan {
  marks: PlannedMark[];
  reverts: PlannedRevert[];
  skipped: SkippedDate[];
  invalidRanges: string[];
}

interface DateRange {
  startDate: string;
  endDate: string;
}

export function planLeaveRequest(
  classification: Pick<LeaveRequestClassification, 'entries' | 'cancellations'>,
  today: string,
): LeavePlan {
  const earliest = addDays(today, -PAST_WINDOW_DAYS);
  const latest = addDays(today, FUTURE_WINDOW_DAYS);
  const skipped = new Map<string, SkippedDate>();
  const invalidRanges: string[] = [];

  const usableDates = (range: DateRange): string[] => {
    if (
      !isValidDateString(range.startDate) ||
      !isValidDateString(range.endDate) ||
      range.endDate < range.startDate
    ) {
      invalidRanges.push(`${range.startDate}..${range.endDate}`);
      return [];
    }
    const dates = expandDateRange(
      range.startDate,
      range.endDate,
      MAX_DAYS_PER_RANGE,
    );
    const isSingleDay = dates.length === 1;
    return dates.filter((date) => {
      if (isWeekend(date)) {
        if (isSingleDay) skipped.set(date, { date, reason: 'weekend' });
        return false;
      }
      if (date < earliest) {
        skipped.set(date, { date, reason: 'too_far_back' });
        return false;
      }
      if (date > latest) {
        skipped.set(date, { date, reason: 'too_far_ahead' });
        return false;
      }
      return true;
    });
  };

  const marksByDate = new Map<string, PlannedMark>();
  for (const entry of classification.entries)
    for (const date of usableDates(entry)) {
      const candidate = { date, kind: entry.kind, portion: entry.portion };
      const current = marksByDate.get(date);
      if (!current || markPriority(candidate) > markPriority(current))
        marksByDate.set(date, candidate);
    }

  const revertsByDate = new Map<string, PlannedRevert>();
  for (const cancellation of classification.cancellations)
    for (const date of usableDates(cancellation))
      if (!marksByDate.has(date))
        revertsByDate.set(date, { date, kind: cancellation.kind });

  const byDate = <T extends { date: string }>(a: T, b: T) =>
    a.date.localeCompare(b.date);
  return {
    marks: [...marksByDate.values()].sort(byDate),
    reverts: [...revertsByDate.values()].sort(byDate),
    skipped: [...skipped.values()].sort(byDate),
    invalidRanges,
  };
}

function markPriority({ kind, portion }: PlannedMark): number {
  const isLeave = kind !== 'wfh';
  const isFullDay = portion === 'full';
  return (isLeave ? 2 : 0) + (isFullDay ? 1 : 0);
}
