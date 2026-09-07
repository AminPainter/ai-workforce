import { tool } from 'ai';
import { z } from 'zod';
import { formatIstDate } from '../../../common/date.util';
import { type SnacksLedgerService } from '../services/snacks-ledger.service';

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
            `${pledge.fullName} — ${formatIstDate(pledge.pledgedAt)} IST: ${pledge.text}`,
        )
        .join('\n');
    },
  });
}
