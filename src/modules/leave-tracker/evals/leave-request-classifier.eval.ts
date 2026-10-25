import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Golden } from 'deepeval/dataset';
import { type BaseMetric } from 'deepeval/metrics';
import { AISDKModel } from 'deepeval/models';
import { LLMTestCase } from 'deepeval/test-case';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toIstDateString } from '../../../common/utils/date.util.js';
import { AiService } from '../../ai/services/ai.service.js';
import { AiModel } from '../../ai/constants/ai-models.js';
import { createLeaveRequestClassifier } from '../agents/leave-request-classifier.agent.js';
import {
  leaveRequestClassificationSchema,
  type LeaveRequestClassification,
} from '../agents/leave-request-classifier.schema.js';
import {
  formatClassifierInput,
  ThreadMessageSender,
} from '../utils/classifier-input.js';
import { planLeaveRequest } from '../utils/leave-plan.js';
import { ClarificationQualityMetric } from './metrics/clarification-quality.metric.js';
import {
  type LeaveClassifierMetadata,
  type LeaveClassifierResult,
} from './metrics/leave-classifier-metadata.js';
import { LeaveIntentMetric } from './metrics/leave-intent.metric.js';
import { LeaveMarksMetric } from './metrics/leave-marks.metric.js';

process.loadEnvFile();

// Wednesday 2026-10-07, 09:30 IST.
const EVAL_NOW = new Date('2026-10-07T09:30:00+05:30');
const AUTHOR_ID = 'U0AUTHOR01';

const aiService = new AiService(new ConfigService());
const classifier = createLeaveRequestClassifier(aiService);
const judge = new AISDKModel({
  model: aiService.model(AiModel.KIMI_K3),
});

const goldenMetadataSchema = z.object({
  postedAt: z.iso.datetime({ offset: true }),
  thread: z
    .array(
      z.object({
        sender: z.enum(ThreadMessageSender),
        name: z.string().default('Employee'),
        text: z.string(),
        postedAt: z.iso.datetime({ offset: true }),
      }),
    )
    .default([]),
  expected: z.object({
    intent: leaveRequestClassificationSchema.shape.intent,
    marks: z.array(z.string()),
  }),
});

const goldens = (
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, 'goldens/leave-request-classifier.json'),
      'utf8',
    ),
  ) as ConstructorParameters<typeof Golden>[0][]
).map((record) => new Golden(record));

function metricsFor(expected: LeaveClassifierResult): BaseMetric[] {
  const metrics: BaseMetric[] = [
    new LeaveIntentMetric(),
    new LeaveMarksMetric(),
  ];
  if (expected.intent === 'clarify')
    metrics.push(new ClarificationQualityMetric(judge));
  return metrics;
}

async function runClassifier(
  golden: Golden,
  { postedAt, thread, expected }: z.infer<typeof goldenMetadataSchema>,
): Promise<LLMTestCase> {
  const input = formatClassifierInput({
    now: EVAL_NOW,
    postedAt: new Date(postedAt),
    authorName: 'Employee',
    authorUserId: AUTHOR_ID,
    text: golden.input,
    earlierThreadMessages: thread.map((message) => ({
      ...message,
      postedAt: new Date(message.postedAt),
    })),
  });
  const { output } = (await classifier.generate({
    messages: [{ role: 'user', content: input }],
  })) as { output: LeaveRequestClassification };
  const plan = planLeaveRequest(output, toIstDateString(EVAL_NOW));

  const actual: LeaveClassifierResult = {
    intent: output.intent,
    marks: plan.marks.map(
      ({ date, kind, portion }) => `${date} ${kind} ${portion}`,
    ),
  };
  const metadata: LeaveClassifierMetadata = { actual, expected };
  return new LLMTestCase({
    name: golden.name,
    input,
    actualOutput: JSON.stringify({
      ...actual,
      clarificationQuestion: output.clarificationQuestion,
    }),
    expectedOutput: JSON.stringify(expected),
    additionalMetadata: metadata,
  });
}

describe('leave request classifier', () => {
  it.each(goldens)('$name', async (golden) => {
    const metadata = goldenMetadataSchema.parse(golden.additionalMetadata);
    await expect(await runClassifier(golden, metadata)).toPass(
      metricsFor(metadata.expected),
    );
  });
});
