/**
 * Phase 0 probe for the RazorpayX Payroll attendance API used by the leave bot.
 *
 * Run:
 *   pnpm rzp:probe fetch <email> <YYYY-MM-DD>
 *   pnpm rzp:probe leave-types <entityId> <email> <YYYY-MM-DD> --confirm
 *   pnpm rzp:probe mark <entityId> <email> <YYYY-MM-DD> <status> <leaveType> --confirm
 *   pnpm rzp:probe revert <entityId> <email> <YYYY-MM-DD> --confirm
 *
 * `fetch` is read-only and probes every configured entity. Every other command
 * writes to PRODUCTION payroll and needs --confirm; only use a test employee and
 * date agreed with the People team.
 *
 * Env required: RAZORPAYX_PAYROLL_ENTITIES.
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { RazorpayxModule } from '../src/modules/razorpayx/razorpayx.module';
import { RazorpayxPayrollService } from '../src/modules/razorpayx/services/razorpayx-payroll.service';
import type { AttendanceStatus } from '../src/modules/razorpayx/razorpayx.types';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), RazorpayxModule],
})
class ProbeModule {}

const USAGE = `usage:
  fetch <email> <date>
  leave-types <entityId> <email> <date> --confirm
  mark <entityId> <email> <date> <status> <leaveType> --confirm
  revert <entityId> <email> <date> --confirm`;

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== '--confirm');
  const confirmed = process.argv.includes('--confirm');
  const [command, ...rest] = args;

  const app = await NestFactory.createApplicationContext(ProbeModule, {
    logger: ['error', 'warn', 'log'],
  });
  const payroll = app.get(RazorpayxPayrollService);
  const print = (label: string, value: unknown) =>
    console.log(`${label}:`, JSON.stringify(value, null, 2));

  const requireConfirm = () => {
    if (confirmed) {
      console.log('⚠ prod: writing to RazorpayX Payroll');
      return;
    }
    throw new Error(
      'this command writes to production payroll; re-run with --confirm',
    );
  };

  try {
    switch (command) {
      case 'fetch': {
        const [email, date] = rest;
        for (const entityId of payroll.entityIds)
          try {
            print(
              `entity ${entityId}`,
              await payroll.fetchAttendance(entityId, email, date),
            );
          } catch (error) {
            print(
              `entity ${entityId} error`,
              error instanceof Error
                ? { name: error.name, message: error.message }
                : error,
            );
          }

        break;
      }
      case 'leave-types': {
        requireConfirm();
        const [entityId, email, date] = rest;
        print(
          'leave types',
          await payroll.listLeaveTypes(Number(entityId), email, date),
        );
        break;
      }
      case 'mark': {
        requireConfirm();
        const [entityId, email, date, status, leaveType] = rest;
        await payroll.modifyAttendance(Number(entityId), {
          email,
          date,
          status: status as AttendanceStatus,
          leaveType: Number(leaveType),
          remarks: 'Leave bot probe. Applied via Slack leave bot',
        });
        print(
          'after',
          await payroll.fetchAttendance(Number(entityId), email, date),
        );
        break;
      }
      case 'revert': {
        requireConfirm();
        const [entityId, email, date] = rest;
        await payroll.modifyAttendance(Number(entityId), {
          email,
          date,
          status: 'present',
          remarks: 'Leave bot probe. Cancelled via Slack leave bot',
        });
        print(
          'after',
          await payroll.fetchAttendance(Number(entityId), email, date),
        );
        break;
      }
      default:
        console.log(USAGE);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
