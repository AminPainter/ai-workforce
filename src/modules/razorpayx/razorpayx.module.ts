import { Module } from '@nestjs/common';
import { RazorpayxPayrollService } from './services/razorpayx-payroll.service.js';

@Module({
  providers: [RazorpayxPayrollService],
  exports: [RazorpayxPayrollService],
})
export class RazorpayxModule {}
