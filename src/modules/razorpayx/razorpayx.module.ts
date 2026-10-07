import { Module } from '@nestjs/common';
import { RazorpayxPayrollService } from './services/razorpayx-payroll.service';

@Module({
  providers: [RazorpayxPayrollService],
  exports: [RazorpayxPayrollService],
})
export class RazorpayxModule {}
