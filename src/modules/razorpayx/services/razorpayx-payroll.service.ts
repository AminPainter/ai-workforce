import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  EmployeeNotFoundError,
  RazorpayxApiError,
  type AttendanceRecord,
  type AttendanceWrite,
  type RazorpayxEntity,
  type RazorpayxFetchResponse,
} from '../razorpayx.types';

const PAYROLL_API_BASE_URL = 'https://payroll.razorpay.com/api';
const REQUEST_TIMEOUT_MS = 15_000;
const USER_NOT_FOUND_CODE = 8;
const USER_NOT_FOUND_PATTERN = /unable to locate/i;
const RECORD_NOT_FOUND_PATTERN = /record .*does not exist/i;

type HttpMethod = 'POST' | 'PATCH';

@Injectable()
export class RazorpayxPayrollService {
  private readonly logger = new Logger(RazorpayxPayrollService.name);
  private readonly entities: RazorpayxEntity[];
  private readonly payrollClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.entities = parseEntities(
      this.configService.get<string>('RAZORPAYX_PAYROLL_ENTITIES'),
    );
    this.payrollClient = axios.create({
      baseURL: PAYROLL_API_BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });
  }

  get entityIds(): number[] {
    return this.entities.map((entity) => entity.id);
  }

  entityName(entityId: number): string {
    return this.getEntity(entityId).name;
  }

  async fetchAttendance(
    entityId: number,
    email: string,
    date: string,
  ): Promise<AttendanceRecord> {
    let body: RazorpayxFetchResponse;
    try {
      body = await this.call<RazorpayxFetchResponse>(
        'POST',
        entityId,
        'fetch',
        {
          email,
          'employee-type': 'employee',
          date,
        },
      );
    } catch (error) {
      if (
        error instanceof RazorpayxApiError &&
        !(error instanceof EmployeeNotFoundError) &&
        RECORD_NOT_FOUND_PATTERN.test(error.message)
      )
        body = {};
      else throw error;
    }
    const data = body.data ?? {};
    return {
      employeeId: data['employee-id'] ?? null,
      date: data.date ?? date,
      statusCode: data.status?.code ?? null,
      statusDescription: data.status?.description ?? null,
      leaveTypeCode: data['leave-type']?.code ?? null,
      leaveTypeDescription: data['leave-type']?.description ?? null,
      requestedStatusCode: data['requested-status']?.code ?? null,
      requestedLeaveTypeCode: data['requested-leave-type']?.code ?? null,
    };
  }

  async modifyAttendance(
    entityId: number,
    write: AttendanceWrite,
  ): Promise<void> {
    const data: Record<string, unknown> = {
      email: write.email,
      'employee-type': 'employee',
      date: write.date,
      status: write.status,
      remarks: write.remarks,
    };
    if (write.leaveType !== undefined) data['leave-type'] = write.leaveType;

    try {
      await this.call('PATCH', entityId, 'modify', data);
    } catch (error) {
      if (error instanceof EmployeeNotFoundError) throw error;
      this.logger.warn(
        `PATCH modify failed for entity ${entityId} on ${write.date}, retrying as POST: ${String(error)}`,
      );
      await this.call('POST', entityId, 'modify', data);
    }
  }

  private async call<T extends { status?: string }>(
    method: HttpMethod,
    entityId: number,
    subType: 'fetch' | 'modify',
    data: Record<string, unknown>,
  ): Promise<T> {
    const entity = this.getEntity(entityId);
    const response = await this.payrollClient.request<T>({
      url: '/att',
      method,
      data: {
        auth: { id: entity.id, key: entity.key },
        request: { type: 'attendance', 'sub-type': subType },
        data,
      },
    });
    const body = response.data;
    const summary = `RazorpayX ${method} attendance/${subType} entity=${entityId} date=${String(data.date)}`;

    const isOk =
      response.status < 400 &&
      typeof body === 'object' &&
      body !== null &&
      (body.status === 'ok' || (subType === 'fetch' && 'data' in body));
    if (isOk) {
      this.logger.log(`${summary} ok: ${JSON.stringify(body)}`);
      return body;
    }

    this.logger.warn(
      `${summary} failed: ${response.status} ${JSON.stringify(body)}`,
    );
    const { code, message } = extractError(body);
    if (code === USER_NOT_FOUND_CODE || USER_NOT_FOUND_PATTERN.test(message))
      throw new EmployeeNotFoundError(message, code, body);
    throw new RazorpayxApiError(message, code, body);
  }

  private getEntity(entityId: number): RazorpayxEntity {
    const entity = this.entities.find(({ id }) => id === entityId);
    if (!entity)
      throw new Error(
        `RazorpayX entity ${entityId} is not configured in RAZORPAYX_PAYROLL_ENTITIES`,
      );
    return entity;
  }
}

function parseEntities(raw: string | undefined): RazorpayxEntity[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Array<Partial<RazorpayxEntity>>;
  return parsed.map((entity) => {
    if (typeof entity.id !== 'number' || typeof entity.key !== 'string')
      throw new Error(
        'RAZORPAYX_PAYROLL_ENTITIES must be a JSON array of {"id": number, "key": string, "name": string}',
      );
    return {
      id: entity.id,
      key: entity.key,
      name: entity.name ?? String(entity.id),
    };
  });
}

function extractError(body: unknown): { code: number | null; message: string } {
  if (typeof body !== 'object' || body === null)
    return { code: null, message: stringify(body) };
  const record = body as Record<string, unknown>;
  const error = record.error;
  if (typeof error === 'object' && error !== null) {
    const nested = error as Record<string, unknown>;
    return {
      code: toCode(nested.code ?? record.code),
      message: stringify(nested.message ?? nested.description ?? error),
    };
  }
  return {
    code: toCode(record.code),
    message: stringify(error ?? record.message ?? body),
  };
}

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function toCode(value: unknown): number | null {
  const code = Number(value);
  return Number.isFinite(code) ? code : null;
}
