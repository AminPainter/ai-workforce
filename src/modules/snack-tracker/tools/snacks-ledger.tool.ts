import { tool } from 'ai';
import { z } from 'zod';
import { formatIstDate } from '../../../common/utils/date.util';
import { type SnacksLedgerService } from '../services/snacks-ledger.service';

export function createSnacksLedgerTool(
  snacksLedgerService: SnacksLedgerService,
) {
  return tool({
    description:
      "List every open snacks pledge in #bakar. Use for questions like 'whose snacks are pending' or 'who owes snacks', and to find the pledge to settle. Each line ends with an internal handle [ref:...] — pass it to markSnacksFulfilled to settle that pledge. Never show the [ref:...] handle to people.",
    inputSchema: z.object({}),
    execute: async () => {
      const pledges = await snacksLedgerService.listOpenPledges();
      if (pledges.length === 0) return "No snacks pending — everyone's square.";

      return pledges
        .map(
          (pledge) =>
            `${pledge.fullName} — ${formatIstDate(pledge.pledgedAt)} IST: ${pledge.text} [ref:${pledge.messageId}]`,
        )
        .join('\n');
    },
  });
}
