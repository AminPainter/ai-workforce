import type { AttendanceStatus } from '../../razorpayx/razorpayx.types';

export const LEAVE_KINDS = [
  'earned',
  'sick',
  'maternity',
  'paternity',
  'bereavement',
  'marriage',
  'period',
  'optional',
  'wfh',
] as const;

export type LeaveKind = (typeof LEAVE_KINDS)[number];

export const LEAVE_PORTIONS = ['full', 'first_half', 'second_half'] as const;

export type LeavePortion = (typeof LEAVE_PORTIONS)[number];

export const LEAVE_KIND_LABELS: Record<LeaveKind, string> = {
  earned: 'Earned Leave',
  sick: 'Sick Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  bereavement: 'Bereavement Leave',
  marriage: 'Marriage Leave',
  period: 'Period Leave',
  optional: 'Optional Leave',
  wfh: 'WFH',
};

type NonWfhLeaveKind = Exclude<LeaveKind, 'wfh'>;

interface EntityLeaveTypeCodes {
  leave: Record<NonWfhLeaveKind, number>;
  wfhFullDay: number;
  wfhHalfDay: number;
}

// Codes are indices into the entity's leaveAttendanceConfig.typesOfLeaves.
// 337931 was read from the RazorpayX dashboard on 2026-10-07; add 337936 once confirmed.
export const LEAVE_TYPE_CODES_BY_ENTITY: Record<number, EntityLeaveTypeCodes> =
  {
    337931: {
      leave: {
        earned: 0,
        sick: 1,
        maternity: 2,
        paternity: 3,
        bereavement: 4,
        marriage: 5,
        period: 6,
        optional: 7,
      },
      wfhFullDay: 8,
      wfhHalfDay: 9,
    },
  };

export const RAZORPAYX_STATUS_CODE_BY_STATUS: Partial<
  Record<AttendanceStatus, number>
> = {
  leave: 20,
  'half-day': 25,
};

export const RAZORPAYX_LEAVE_STATUS_CODES = new Set(
  Object.values(RAZORPAYX_STATUS_CODE_BY_STATUS),
);

export interface AttendanceTarget {
  status: AttendanceStatus;
  leaveType: number;
}

export function toAttendanceTarget(
  entityId: number,
  kind: LeaveKind,
  portion: LeavePortion,
): AttendanceTarget | null {
  const codes = LEAVE_TYPE_CODES_BY_ENTITY[entityId];
  if (!codes) return null;
  if (kind === 'wfh')
    return {
      status: 'leave',
      leaveType: portion === 'full' ? codes.wfhFullDay : codes.wfhHalfDay,
    };
  return {
    status: portion === 'full' ? 'leave' : 'half-day',
    leaveType: codes.leave[kind],
  };
}

export function leaveKindsForCode(
  entityId: number,
  leaveTypeCode: number,
): LeaveKind[] {
  const codes = LEAVE_TYPE_CODES_BY_ENTITY[entityId];
  if (!codes) return [];
  if (leaveTypeCode === codes.wfhFullDay || leaveTypeCode === codes.wfhHalfDay)
    return ['wfh'];
  return (Object.keys(codes.leave) as NonWfhLeaveKind[]).filter(
    (kind) => codes.leave[kind] === leaveTypeCode,
  );
}

export function describeEntry(kind: LeaveKind, portion: LeavePortion): string {
  const label = LEAVE_KIND_LABELS[kind];
  if (portion === 'full') return kind === 'wfh' ? `${label} (full day)` : label;
  const half = portion === 'first_half' ? '1st half' : '2nd half';
  return `${label} (half day, ${half})`;
}
