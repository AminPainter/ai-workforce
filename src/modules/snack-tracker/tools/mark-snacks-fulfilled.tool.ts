import { tool } from 'ai';
import { z } from 'zod';
import { formatIstDate } from '../../../common/utils/date.util';
import { type SnacksLedgerService } from '../services/snacks-ledger.service';

export function createMarkSnacksFulfilledTool(
  snacksLedgerService: SnacksLedgerService,
  bakarChannelId: string,
) {
  return tool({
    description:
      "Settle exactly one open #bakar snacks pledge — the person bought the snacks. A pledge can only be settled by the person who owes it; refuse if someone tries to clear another person's pledge. First call snacksLedger to load the open pledges, resolve the person's words to a single pledge (speaker name for 'my', the IST date for 'from <date>', item or recency otherwise), then pass that pledge's [ref:...] handle here. If the words match no open pledge or more than one, ask the person to clarify instead of guessing. Settling works only in the #bakar channel. Never show the ref to people.",
    inputSchema: z.object({
      ref: z
        .string()
        .describe(
          'The [ref:...] handle of the pledge to settle, from snacksLedger.',
        ),
    }),
    contextSchema: z.object({
      channelId: z.string(),
      requesterUserId: z.string(),
    }),
    execute: async (
      { ref }: { ref: string },
      { context }: { context: { channelId: string; requesterUserId: string } },
    ): Promise<string> => {
      if (context.channelId !== bakarChannelId)
        return 'Snacks pledges can only be settled from the #bakar channel.';

      const result = await snacksLedgerService.fulfillPledge(
        ref,
        context.requesterUserId,
      );
      if (!result.found)
        return "Couldn't find that pledge — let me re-check the pending list.";
      if (result.notOwner)
        return `That pledge is on ${result.record!.fullName} — only they can settle it. You can't clear someone else's snacks.`;
      if (result.alreadyFulfilled) return "That one's already settled.";

      const record = result.record!;
      return `Done — cleared ${record.fullName}'s pledge from ${formatIstDate(record.pledgedAt)} IST off the pending list.`;
    },
  });
}
