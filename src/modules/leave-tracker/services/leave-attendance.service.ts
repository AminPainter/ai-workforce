import { Injectable, Logger } from '@nestjs/common';
import { RazorpayxPayrollService } from '../../razorpayx/services/razorpayx-payroll.service';
import {
  EmployeeNotFoundError,
  type AttendanceRecord,
  type AttendanceWrite,
} from '../../razorpayx/razorpayx.types';
import {
  RAZORPAYX_LEAVE_STATUS_CODES,
  RAZORPAYX_STATUS_CODE_BY_STATUS,
  describeEntry,
  leaveKindsForCode,
  toAttendanceTarget,
  type AttendanceTarget,
  type LeaveKind,
  type LeavePortion,
} from '../constants/leave-kinds';
import type { PlannedMark, PlannedRevert } from '../utils/leave-plan';

const MARK_REMARKS_SUFFIX = 'Applied via Slack leave bot';
const REVERT_REMARKS = 'Cancelled via Slack leave bot';

export type DateOutcomeStatus =
  'done' | 'already_done' | 'left_unchanged' | 'mismatch' | 'failed';

export interface DateOutcome {
  date: string;
  operation: 'mark' | 'revert';
  kind: LeaveKind | null;
  portion: LeavePortion | null;
  status: DateOutcomeStatus;
  detail?: string;
}

export interface ApplyLeavePlanInput {
  email: string;
  actorSlackUserId: string;
  sourceMessageId: string;
  today: string;
  marks: PlannedMark[];
  reverts: PlannedRevert[];
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

    const outcomes: DateOutcome[] = [];
    for (const mark of input.marks)
      outcomes.push(await this.applyMark(input, employee, mark));
    for (const revert of input.reverts)
      outcomes.push(await this.applyRevert(input, employee, revert));
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
        if (error instanceof EmployeeNotFoundError) continue;
        this.logger.warn(
          `company ${companyId} probe errored without "user not found"; using it anyway: ${String(error)}`,
        );
        return { companyId, email };
      }

    return null;
  }

  private async applyMark(
    input: ApplyLeavePlanInput,
    employee: EmployeeCompany,
    { date, kind, portion }: PlannedMark,
  ): Promise<DateOutcome> {
    const base = { date, operation: 'mark' as const, kind, portion };
    const target = toAttendanceTarget(employee.companyId, kind, portion);
    if (!target)
      return this.audit(input, employee, null, {
        ...base,
        status: 'failed',
        detail: `leave-type codes for RazorpayX company ${employee.companyId} are not configured`,
      });

    const before = await this.tryFetch(employee, date);
    if (before && matchesTarget(before, target))
      return this.audit(input, employee, null, {
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
      return this.audit(input, employee, write, {
        ...base,
        status: 'failed',
        detail: errorMessage(error),
      });
    }

    const after = await this.tryFetch(employee, date);
    if (!after || matchesTarget(after, target))
      return this.audit(input, employee, write, {
        ...base,
        status: 'done',
        detail: after ? undefined : 'written, read-back unavailable',
      });
    const isPendingApproval =
      after.requestedStatusCode ===
        RAZORPAYX_STATUS_CODE_BY_STATUS[target.status] &&
      after.requestedLeaveTypeCode === target.leaveType;
    return this.audit(input, employee, write, {
      ...base,
      status: 'mismatch',
      detail: isPendingApproval
        ? 'submitted as a request that is pending approval'
        : `RazorpayX now shows ${describeRecord(after)}`,
    });
  }

  private async applyRevert(
    input: ApplyLeavePlanInput,
    employee: EmployeeCompany,
    { date, kind }: PlannedRevert,
  ): Promise<DateOutcome> {
    const base = {
      date,
      operation: 'revert' as const,
      kind,
      portion: null,
    };
    const before = await this.tryFetch(employee, date);
    if (before && !isLeaveRecord(before))
      return this.audit(input, employee, null, {
        ...base,
        status: 'already_done',
      });
    if (
      before &&
      kind &&
      before.leaveTypeCode !== null &&
      !leaveKindsForCode(employee.companyId, before.leaveTypeCode).includes(
        kind,
      )
    )
      return this.audit(input, employee, null, {
        ...base,
        status: 'left_unchanged',
        detail: `RazorpayX shows ${describeRecord(before)}`,
      });

    const write: AttendanceWrite = {
      email: employee.email,
      date,
      status: 'present',
      remarks: REVERT_REMARKS,
    };
    try {
      await this.razorpayxPayrollService.modifyAttendance(
        employee.companyId,
        write,
      );
    } catch (error) {
      return this.audit(input, employee, write, {
        ...base,
        status: 'failed',
        detail: errorMessage(error),
      });
    }

    const after = await this.tryFetch(employee, date);
    if (after && isLeaveRecord(after))
      return this.audit(input, employee, write, {
        ...base,
        status: 'mismatch',
        detail: `RazorpayX still shows ${describeRecord(after)}`,
      });
    return this.audit(input, employee, write, { ...base, status: 'done' });
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
    write: AttendanceWrite | null,
    outcome: DateOutcome,
  ): DateOutcome {
    this.logger.log(
      `audit ${JSON.stringify({
        sourceMessageId: input.sourceMessageId,
        actorSlackUserId: input.actorSlackUserId,
        companyId: employee.companyId,
        date: outcome.date,
        operation: outcome.operation,
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

function isLeaveRecord(record: AttendanceRecord): boolean {
  return (
    record.statusCode !== null &&
    RAZORPAYX_LEAVE_STATUS_CODES.has(record.statusCode)
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
