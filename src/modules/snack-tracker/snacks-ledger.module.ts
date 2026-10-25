import { Module } from '@nestjs/common';
import { SnacksLedgerService } from './services/snacks-ledger.service.js';

@Module({
  providers: [SnacksLedgerService],
  exports: [SnacksLedgerService],
})
export class SnacksLedgerModule {}
