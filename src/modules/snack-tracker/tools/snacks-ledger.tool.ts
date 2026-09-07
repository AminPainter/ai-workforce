import { tool } from 'ai';
import { z } from 'zod';
import {
  type SnacksLedgerService,
  type SnacksPledgeRecord,
} from '../services/snacks-ledger.service';

interface PendingDebtor {
  fullName: string;
  count: number;
  oldestPledgedAt: string;
}

function aggregatePendingDebtors(
  pledges: SnacksPledgeRecord[],
): PendingDebtor[] {
  const byUser = new Map<string, PendingDebtor>();
  for (const pledge of pledges) {
    const existing = byUser.get(pledge.userId);
    if (!existing) {
      byUser.set(pledge.userId, {
        fullName: pledge.fullName,
        count: 1,
        oldestPledgedAt: pledge.pledgedAt,
      });
      continue;
    }
    existing.count += 1;
    if (pledge.pledgedAt < existing.oldestPledgedAt)
      existing.oldestPledgedAt = pledge.pledgedAt;
  }
  return [...byUser.values()].sort((a, b) =>
    a.oldestPledgedAt.localeCompare(b.oldestPledgedAt),
  );
}

function formatDate(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoTimestamp));
}

export function createSnacksLedgerTool(
  snacksLedgerService: SnacksLedgerService,
) {
  return tool({
    description:
      "List everyone in #bakar with an open snacks pledge. Use for questions like 'whose snacks are pending' or 'who owes snacks'. Every recorded pledge counts as pending — there is no settle step yet.",
    inputSchema: z.object({}),
    execute: async () => {
      const debtors = aggregatePendingDebtors(
        await snacksLedgerService.listPledges(),
      );
      if (debtors.length === 0)
        return "No snacks pending — everyone's square.";

      return debtors
        .map(
          (debtor) =>
            `${debtor.fullName} — ${debtor.count} pledge(s), oldest ${formatDate(debtor.oldestPledgedAt)} IST`,
        )
        .join('\n');
    },
  });
}
