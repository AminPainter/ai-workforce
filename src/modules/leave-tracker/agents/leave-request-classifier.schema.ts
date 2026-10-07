import { z } from 'zod';
import { LEAVE_KINDS, LEAVE_PORTIONS } from '../constants/leave-kinds';

const dateField = z
  .string()
  .describe('Calendar date in YYYY-MM-DD format (IST).');

export const leaveRequestClassificationSchema = z.object({
  intent: z
    .enum(['mark', 'cancel', 'cancel_and_mark', 'clarify', 'ignore'])
    .describe(
      'mark: the person announces leave/WFH on concrete dates. cancel: withdraws previously announced leave/WFH. cancel_and_mark: withdraws some dates and announces replacement or corrected ones in the same message. clarify: it is about taking leave/WFH but the dates or the type cannot be determined with confidence (conditional, vague or tentative). ignore: everything else (late start, leaving early, AFK, bumps with nothing new, questions, chit-chat, join notices).',
    ),
  subjectSlackUserId: z
    .string()
    .nullable()
    .describe(
      'Slack user id (U...) of the person the leave is FOR, only when the author explicitly asks to mark leave on behalf of someone else ("Mark sick leave today for @X"). null in every other case, including cc/@mentions/FYI tags.',
    ),
  entries: z
    .array(
      z.object({
        startDate: dateField,
        endDate: dateField.describe(
          'Last date of the range, inclusive. Same as startDate for a single day.',
        ),
        kind: z
          .enum(LEAVE_KINDS)
          .describe(
            'earned for planned/personal leave, day off, OOO, travel, family events. sick for illness. period for cramps/period pain. optional for optional leave. wfh for work from home / working remotely.',
          ),
        portion: z
          .enum(LEAVE_PORTIONS)
          .describe(
            'full for a whole day. first_half / second_half for half-day leave or half-day WFH.',
          ),
      }),
    )
    .describe(
      'Dates to mark. Use one entry per contiguous range with the same kind and portion. Empty unless intent is mark or cancel_and_mark.',
    ),
  cancellations: z
    .array(
      z.object({
        startDate: dateField,
        endDate: dateField,
        kind: z
          .enum(LEAVE_KINDS)
          .nullable()
          .describe(
            'The kind being cancelled if stated ("cancelling my WFH" -> wfh), else null.',
          ),
      }),
    )
    .describe(
      'Dates whose previously announced leave/WFH is withdrawn. Empty unless intent is cancel or cancel_and_mark.',
    ),
  clarificationQuestion: z
    .string()
    .nullable()
    .describe(
      'When intent is clarify: one short, friendly question to the author that, once answered, gives concrete dates and type. Do not mention health details. null otherwise.',
    ),
  reason: z
    .string()
    .describe('One short sentence explaining the decision, for logs only.'),
});

export type LeaveRequestClassification = z.infer<
  typeof leaveRequestClassificationSchema
>;
