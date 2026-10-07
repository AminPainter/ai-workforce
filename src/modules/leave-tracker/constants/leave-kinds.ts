import type { AttendanceStatus } from '../../razorpayx/razorpayx.types';

export enum LeaveKind {
  Earned = 'earned',
  Sick = 'sick',
  Maternity = 'maternity',
  Paternity = 'paternity',
  Bereavement = 'bereavement',
  Marriage = 'marriage',
  Period = 'period',
  Optional = 'optional',
  Wfh = 'wfh',
}

export const LEAVE_PORTIONS = ['full', 'first_half', 'second_half'] as const;

export type LeavePortion = (typeof LEAVE_PORTIONS)[number];

export const LEAVE_KIND_LABELS: Record<LeaveKind, string> = {
  [LeaveKind.Earned]: 'Earned Leave',
  [LeaveKind.Sick]: 'Sick Leave',
  [LeaveKind.Maternity]: 'Maternity Leave',
  [LeaveKind.Paternity]: 'Paternity Leave',
  [LeaveKind.Bereavement]: 'Bereavement Leave',
  [LeaveKind.Marriage]: 'Marriage Leave',
  [LeaveKind.Period]: 'Period Leave',
  [LeaveKind.Optional]: 'Optional Leave',
  [LeaveKind.Wfh]: 'WFH',
};

type NonWfhLeaveKind = Exclude<LeaveKind, LeaveKind.Wfh>;

interface CompanyLeaveTypeCodes {
  leave: Record<NonWfhLeaveKind, number>;
  wfhFullDay: number;
  wfhHalfDay: number;
}

const GLOMOPAY_SOFTWARE_PRIVATE_LIMITED_COMPANY_ID = 337931;

// TODO: add Glomo Payments IFSC Private Limited (GIFT City).
export const LEAVE_TYPE_CODES_BY_COMPANY: Record<
  number,
  CompanyLeaveTypeCodes
> = {
  [GLOMOPAY_SOFTWARE_PRIVATE_LIMITED_COMPANY_ID]: {
    leave: {
      [LeaveKind.Earned]: 0,
      [LeaveKind.Sick]: 1,
      [LeaveKind.Maternity]: 2,
      [LeaveKind.Paternity]: 3,
      [LeaveKind.Bereavement]: 4,
      [LeaveKind.Marriage]: 5,
      [LeaveKind.Period]: 6,
      [LeaveKind.Optional]: 7,
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
  companyId: number,
  kind: LeaveKind,
  portion: LeavePortion,
): AttendanceTarget | null {
  const codes = LEAVE_TYPE_CODES_BY_COMPANY[companyId];
  if (!codes) return null;
  if (kind === LeaveKind.Wfh)
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
  companyId: number,
  leaveTypeCode: number,
): LeaveKind[] {
  const codes = LEAVE_TYPE_CODES_BY_COMPANY[companyId];
  if (!codes) return [];
  if (leaveTypeCode === codes.wfhFullDay || leaveTypeCode === codes.wfhHalfDay)
    return [LeaveKind.Wfh];
  return (Object.keys(codes.leave) as NonWfhLeaveKind[]).filter(
    (kind) => codes.leave[kind] === leaveTypeCode,
  );
}

export function describeEntry(kind: LeaveKind, portion: LeavePortion): string {
  const label = LEAVE_KIND_LABELS[kind];
  if (portion === 'full')
    return kind === LeaveKind.Wfh ? `${label} (full day)` : label;
  const half = portion === 'first_half' ? '1st half' : '2nd half';
  return `${label} (half day, ${half})`;
}
