import { tool } from 'ai';
import { z } from 'zod';
import { type SnacksLedgerService } from '../services/snacks-ledger.service';

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
      "List every open snacks pledge in #bakar. Use for questions like 'whose snacks are pending' or 'who owes snacks'. Every recorded pledge counts as pending — there is no settle step yet.",
    inputSchema: z.object({}),
    execute: async () => {
      const pledges = await snacksLedgerService.listPledges();
      if (pledges.length === 0)
        return "No snacks pending — everyone's square.";

      return pledges
        .map(
          (pledge) =>
            `${pledge.fullName} — ${formatDate(pledge.pledgedAt)} IST: ${pledge.text}`,
        )
        .join('\n');
    },
  });
}
