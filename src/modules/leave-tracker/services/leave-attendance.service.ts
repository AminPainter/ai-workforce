import { Injectable, Logger } from '@nestjs/common';
import { RazorpayxPayrollService } from '../../razorpayx/services/razorpayx-payroll.service.js';
import {
  EmployeeNotFoundError,
  type AttendanceRecord,
  type AttendanceWrite,
} from '../../razorpayx/razorpayx.types.js';
import {
  RAZORPAYX_STATUS_CODE_BY_STATUS,
  describeCancelled,
  describeEntry,
  isLeaveRecord,
  kindFromLeaveTypeCode,
  matchesCancelKind,
  toAttendanceTarget,
  type AttendanceTarget,
  type LeaveKind,
  type LeavePortion,
} from '../constants/leave-kinds.js';
import type { PlannedCancel, PlannedMark } from '../utils/leave-plan.js';

const MARK_REMARKS_SUFFIX = 'Applied by leave bot v2';
const CANCEL_REMARKS = 'Leave cancelled via Slack. Cancelled by leave bot v2';

export type DateOutcomeStatus = 'done' | 'already_done' | 'mismatch' | 'failed';

interface MarkOutcome {
  action: 'mark';
  date: string;
  kind: LeaveKind;
  portion: LeavePortion;
  status: DateOutcomeStatus;
  detail?: string;
}

interface CancelOutcome {
  action: 'cancel';
  date: string;
  kind: LeaveKind | null;
  status: DateOutcomeStatus;
  detail?: string;
}

export type DateOutcome = MarkOutcome | CancelOutcome;

export interface ApplyLeavePlanInput {
  email: string;
  actorSlackUserId: string;
  sourceMessageId: string;
  today: string;
  marks: PlannedMark[];
  cancels: PlannedCancel[];
}

interface EmployeeCompany {
  companyId: number;
  email: string;
}

export interface ApplyLeavePlanResult {
  employeeFound: boolean;
  outcomes: DateOutcome[];
}

@Injectable()
export class LeaveAttendanceService {
  private readonly logger = new Logger(LeaveAttendanceService.name);

  constructor(
    private readonly razorpayxPayrollService: RazorpayxPayrollService,
  ) {}

  async apply(input: ApplyLeavePlanInput): Promise<ApplyLeavePlanResult> {
    const employee = await this.resolveEmployee(input.email, input.today);
    if (!employee) return { employeeFound: false, outcomes: [] };

    const outcomes = await Promise.all([
      ...input.marks.map((mark) => this.applyMark(input, employee, mark)),
      ...input.cancels.map((cancel) =>
        this.applyCancel(input, employee, cancel),
      ),
    ]);
    return { employeeFound: true, outcomes };
  }

  private async resolveEmployee(
    email: string,
    today: string,
  ): Promise<EmployeeCompany | null> {
    for (const companyId of this.razorpayxPayrollService.companyIds)
      try {
        await this.razorpayxPayrollService.fetchAttendance(
          companyId,
          email,
          today,
        );
        return { companyId, email };
      } catch (error) {
        if (!(error instanceof EmployeeNotFoundError)) throw error;
      }

    return null;
  }

  private async applyMark(
    input: ApplyLeavePlanInput,
    employee: EmployeeCompany,
    { date, kind, portion }: PlannedMark,
  ): Promise<DateOutcome> {
    const base = { action: 'mark' as const, date, kind, portion };
    const target = toAttendanceTarget(employee.companyId, kind, portion);
    if (!target)
      return this.audit(input, employee, null, null, {
        ...base,
        status: 'failed',
        detail: `leave-type codes for RazorpayX company ${employee.companyId} are not configured`,
      });

    const before = await this.tryFetch(employee, date);
    if (before && matchesTarget(before, target))
      return this.audit(input, employee, before, null, {
        ...base,
        status: 'already_done',
      });

    const write: AttendanceWrite = {
      email: employee.email,
      date,
      status: target.status,
      leaveType: target.leaveType,
      remarks: `${describeEntry(kind, portion)}. ${MARK_REMARKS_SUFFIX}`,
    };
    try {
      await this.razorpayxPayrollService.modifyAttendance(
        employee.companyId,
        write,
      );
    } catch (error) {
      return this.audit(input, employee, before, write, {
        ...base,
        status: 'failed',
        detail: errorMessage(error),
      });
    }

    const after = await this.tryFetch(employee, date);
    if (!after || matchesTarget(after, target))
      return this.audit(input, employee, before, write, {
        ...base,
        status: 'done',
        detail: after ? undefined : 'written, read-back unavailable',
      });
    const isPendingApproval =
      after.requestedStatusCode ===
        RAZORPAYX_STATUS_CODE_BY_STATUS[target.status] &&
      after.requestedLeaveTypeCode === target.leaveType;
    return this.audit(input, employee, before, write, {
      ...base,
      status: 'mismatch',
      detail: isPendingApproval
        ? 'submitted as a request that is pending approval'
        : `RazorpayX now shows ${describeRecord(after)}`,
    });
  }

  private async applyCancel(
    input: ApplyLeavePlanInput,
    employee: EmployeeCompany,
    { date, kind }: PlannedCancel,
  ): Promise<DateOutcome> {
    const base = { action: 'cancel' as const, date, kind };
    const before = await this.tryFetch(employee, date);
    if (!before)
      return this.audit(input, employee, null, null, {
        ...base,
        status: 'failed',
        detail: 'could not read the current attendance, so nothing was changed',
      });

    if (
      before.requestedStatusCode !== null ||
      before.requestedLeaveTypeCode !== null
    )
      return this.audit(input, employee, before, null, {
        ...base,
        status: 'mismatch',
        detail: 'a leave request is pending approval, so nothing was changed',
      });

    if (!isLeaveRecord(before))
      return this.audit(input, employee, before, null, {
        ...base,
        status: 'already_done',
      });

    if (!matchesCancelKind(employee.companyId, before, kind))
      return this.audit(input, employee, before, null, {
        ...base,
        status: 'mismatch',
        detail: `RazorpayX shows ${describeRecord(before)}, not ${describeCancelled(kind)}, so nothing was changed`,
      });

    const cancelled = {
      ...base,
      kind: kindFromLeaveTypeCode(employee.companyId, before.leaveTypeCode),
    };
    const write: AttendanceWrite = {
      email: employee.email,
      date,
      status: 'present',
      remarks: CANCEL_REMARKS,
    };
    try {
      await this.razorpayxPayrollService.modifyAttendance(
        employee.companyId,
        write,
      );
    } catch (error) {
      return this.audit(input, employee, before, write, {
        ...cancelled,
        status: 'failed',
        detail: errorMessage(error),
      });
    }

    const after = await this.tryFetch(employee, date);
    if (!after || !isLeaveRecord(after))
      return this.audit(input, employee, before, write, {
        ...cancelled,
        status: 'done',
        detail: after ? undefined : 'written, read-back unavailable',
      });
    return this.audit(input, employee, before, write, {
      ...cancelled,
      status: 'mismatch',
      detail: `RazorpayX still shows ${describeRecord(after)}`,
    });
  }

  private async tryFetch(
    employee: EmployeeCompany,
    date: string,
  ): Promise<AttendanceRecord | null> {
    try {
      return await this.razorpayxPayrollService.fetchAttendance(
        employee.companyId,
        employee.email,
        date,
      );
    } catch (error) {
      this.logger.warn(`attendance read failed for ${date}: ${String(error)}`);
      return null;
    }
  }

  private audit(
    input: ApplyLeavePlanInput,
    employee: EmployeeCompany,
    before: AttendanceRecord | null,
    write: AttendanceWrite | null,
    outcome: DateOutcome,
  ): DateOutcome {
    this.logger.log(
      `audit ${JSON.stringify({
        sourceMessageId: input.sourceMessageId,
        actorSlackUserId: input.actorSlackUserId,
        companyId: employee.companyId,
        action: outcome.action,
        date: outcome.date,
        before: before
          ? { status: before.statusCode, leaveType: before.leaveTypeCode }
          : null,
        request: write
          ? { status: write.status, leaveType: write.leaveType }
          : null,
        outcome: outcome.status,
        detail: outcome.detail,
      })}`,
    );
    return outcome;
  }
}

function matchesTarget(
  record: AttendanceRecord,
  target: AttendanceTarget,
): boolean {
  return (
    record.statusCode === RAZORPAYX_STATUS_CODE_BY_STATUS[target.status] &&
    record.leaveTypeCode === target.leaveType
  );
}

function describeRecord(record: AttendanceRecord): string {
  const status =
    record.statusDescription ?? `status ${record.statusCode ?? 'none'}`;
  return record.leaveTypeDescription
    ? `${status} / ${record.leaveTypeDescription}`
    : status;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
