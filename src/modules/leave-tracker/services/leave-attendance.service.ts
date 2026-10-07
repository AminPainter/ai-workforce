import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import {
  LeaveLedgerService,
  type EmployeeEntity,
} from './leave-ledger.service';

const MARK_REMARKS_SUFFIX = 'Applied via Slack leave bot';
const REVERT_REMARKS = 'Cancelled via Slack leave bot';

export type LeaveBotMode = 'live' | 'shadow';

export type DateOutcomeStatus =
  | 'done'
  | 'already_done'
  | 'would_do'
  | 'left_unchanged'
  | 'mismatch'
  | 'failed';

export interface DateOutcome {
  date: string;
  operation: 'mark' | 'revert';
  kind: LeaveKind | null;
  portion: LeavePortion | null;
  status: DateOutcomeStatus;
  detail?: string;
}

export interface ApplyLeavePlanInput {
  mode: LeaveBotMode;
  email: string;
  actorSlackUserId: string;
  sourceMessageId: string;
  today: string;
  marks: PlannedMark[];
  reverts: PlannedRevert[];
}

export interface ApplyLeavePlanResult {
  employeeFound: boolean;
  outcomes: DateOutcome[];
}

@Injectable()
export class LeaveAttendanceService {
  private readonly logger = new Logger(LeaveAttendanceService.name);
  private readonly emailOverrides: Record<string, string>;

  constructor(
    private readonly razorpayxPayrollService: RazorpayxPayrollService,
    private readonly leaveLedgerService: LeaveLedgerService,
    private readonly configService: ConfigService,
  ) {
    const rawOverrides = this.configService.get<string>(
      'LEAVES_EMAIL_OVERRIDES',
    );
    this.emailOverrides = Object.fromEntries(
      Object.entries(
        rawOverrides
          ? (JSON.parse(rawOverrides) as Record<string, string>)
          : {},
      ).map(([slackEmail, razorpayxEmail]) => [
        slackEmail.toLowerCase(),
        razorpayxEmail,
      ]),
    );
  }

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

  async resolveEmployee(
    email: string,
    today: string,
  ): Promise<EmployeeEntity | null> {
    const cached = await this.leaveLedgerService.getEmployeeEntity(email);
    if (cached) return cached;

    const candidateEmails = [
      ...new Set([email, this.emailOverrides[email.toLowerCase()]]),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const razorpayxEmail of candidateEmails)
      for (const entityId of this.razorpayxPayrollService.entityIds)
        try {
          const record = await this.razorpayxPayrollService.fetchAttendance(
            entityId,
            razorpayxEmail,
            today,
          );
          const employee = {
            entityId,
            razorpayxEmail,
            employeeId: record.employeeId,
          };
          await this.leaveLedgerService.setEmployeeEntity(email, employee);
          return employee;
        } catch (error) {
          if (error instanceof EmployeeNotFoundError) continue;
          this.logger.warn(
            `entity ${entityId} probe errored without "user not found"; using it uncached: ${String(error)}`,
          );
          return { entityId, razorpayxEmail, employeeId: null };
        }

    return null;
  }

  private async applyMark(
    input: ApplyLeavePlanInput,
    employee: EmployeeEntity,
    { date, kind, portion }: PlannedMark,
  ): Promise<DateOutcome> {
    const base = { date, operation: 'mark' as const, kind, portion };
    const target = toAttendanceTarget(employee.entityId, kind, portion);
    if (!target)
      return this.audit(input, employee, null, {
        ...base,
        status: 'failed',
        detail: `leave-type codes for RazorpayX entity ${employee.entityId} are not configured`,
      });

    const before = await this.tryFetch(employee, date);
    if (before && matchesTarget(before, target))
      return this.audit(input, employee, null, {
        ...base,
        status: 'already_done',
      });
    if (input.mode === 'shadow')
      return this.audit(input, employee, null, { ...base, status: 'would_do' });

    const write: AttendanceWrite = {
      email: employee.razorpayxEmail,
      date,
      status: target.status,
      leaveType: target.leaveType,
      remarks: `${describeEntry(kind, portion)}. ${MARK_REMARKS_SUFFIX}`,
    };
    try {
      await this.razorpayxPayrollService.modifyAttendance(
        employee.entityId,
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
    employee: EmployeeEntity,
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
      !leaveKindsForCode(employee.entityId, before.leaveTypeCode).includes(kind)
    )
      return this.audit(input, employee, null, {
        ...base,
        status: 'left_unchanged',
        detail: `RazorpayX shows ${describeRecord(before)}`,
      });
    if (input.mode === 'shadow')
      return this.audit(input, employee, null, { ...base, status: 'would_do' });

    const write: AttendanceWrite = {
      email: employee.razorpayxEmail,
      date,
      status: 'present',
      remarks: REVERT_REMARKS,
    };
    try {
      await this.razorpayxPayrollService.modifyAttendance(
        employee.entityId,
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
    employee: EmployeeEntity,
    date: string,
  ): Promise<AttendanceRecord | null> {
    try {
      return await this.razorpayxPayrollService.fetchAttendance(
        employee.entityId,
        employee.razorpayxEmail,
        date,
      );
    } catch (error) {
      this.logger.warn(`attendance read failed for ${date}: ${String(error)}`);
      return null;
    }
  }

  private async audit(
    input: ApplyLeavePlanInput,
    employee: EmployeeEntity,
    write: AttendanceWrite | null,
    outcome: DateOutcome,
  ): Promise<DateOutcome> {
    await this.leaveLedgerService.appendAudit({
      at: new Date().toISOString(),
      mode: input.mode,
      sourceMessageId: input.sourceMessageId,
      actorSlackUserId: input.actorSlackUserId,
      subjectEmail: employee.razorpayxEmail,
      entityId: employee.entityId,
      date: outcome.date,
      operation: outcome.operation,
      request: write ? { ...write } : null,
      outcome: outcome.status,
      detail: outcome.detail,
    });
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
