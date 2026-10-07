export interface RazorpayxCompany {
  id: number;
  key: string;
  name: string;
}

export type AttendanceStatus =
  'present' | 'leave' | 'half-day' | 'unpaid-leave' | 'unpaid-half-day';

export interface AttendanceWrite {
  email: string;
  date: string;
  status: AttendanceStatus;
  leaveType?: number;
  remarks: string;
}

export interface AttendanceRecord {
  employeeId: string | number | null;
  date: string;
  statusCode: number | null;
  statusDescription: string | null;
  leaveTypeCode: number | null;
  leaveTypeDescription: string | null;
  requestedStatusCode: number | null;
  requestedLeaveTypeCode: number | null;
}

interface CodedValue {
  code?: number | null;
  description?: string | null;
}

export interface RazorpayxFetchResponse {
  status?: string;
  data?: {
    'employee-id'?: string | number | null;
    date?: string;
    status?: CodedValue | null;
    'leave-type'?: CodedValue | null;
    'requested-status'?: CodedValue | null;
    'requested-leave-type'?: CodedValue | null;
  };
  error?: unknown;
  code?: number;
  message?: string;
}

export class RazorpayxApiError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly responseBody: unknown,
  ) {
    super(message);
    this.name = 'RazorpayxApiError';
  }
}

export class EmployeeNotFoundError extends RazorpayxApiError {
  constructor(message: string, code: number | null, responseBody: unknown) {
    super(message, code, responseBody);
    this.name = 'EmployeeNotFoundError';
  }
}
