import { z } from 'zod';
import { LEAVE_PORTIONS, LeaveKind } from '../constants/leave-kinds.js';

const dateField = z
  .string()
  .describe('Calendar date in YYYY-MM-DD format (IST).');

export const leaveRequestClassificationSchema = z.object({
  intent: z
    .enum(['mark', 'cancel', 'clarify', 'ignore'])
    .describe(
      'mark: the person announces leave/WFH on concrete dates, possibly also cancelling other dates. cancel: the person only cancels their own leave/WFH on concrete dates. clarify: it is about taking leave/WFH but the dates or the type cannot be determined with confidence (conditional, vague or tentative). ignore: everything else (late start, leaving early, AFK, bumps with nothing new, questions, chit-chat, join notices, tentative cancellations).',
    ),
  entries: z
    .array(
      z.object({
        startDate: dateField,
        endDate: dateField.describe(
          'Last date of the range, inclusive. Same as startDate for a single day.',
        ),
        kind: z
          .enum(LeaveKind)
          .describe(
            'earned for planned/personal leave, day off, OOO, travel, family events. sick for illness or not having slept. period for cramps/period pain. optional for optional leave. wfh for work from home / working remotely.',
          ),
        portion: z
          .enum(LEAVE_PORTIONS)
          .describe(
            'full for a whole day. first_half / second_half for half-day leave or half-day WFH.',
          ),
      }),
    )
    .describe(
      'Dates to mark. Use one entry per contiguous range with the same kind and portion. Empty unless intent is mark.',
    ),
  cancellations: z
    .array(
      z.object({
        startDate: dateField,
        endDate: dateField.describe(
          'Last date of the range, inclusive. Same as startDate for a single day.',
        ),
        kind: z
          .enum(LeaveKind)
          .nullable()
          .describe(
            'The kind being cancelled when stated or clear from the thread (wfh for cancelled WFH). null when it is not known.',
          ),
      }),
    )
    .describe(
      'Dates the author cancels. One entry per contiguous range. Empty unless the author cancels their own leave/WFH.',
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
