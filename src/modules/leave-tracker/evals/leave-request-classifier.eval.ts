import { ConfigService } from '@nestjs/config';
import { type BaseMetric } from 'deepeval/metrics';
import { AISDKModel } from 'deepeval/models';
import { LLMTestCase } from 'deepeval/test-case';
import { describe, expect, it } from 'vitest';
import { toIstDateString } from '../../../common/utils/date.util';
import { AiService } from '../../ai/services/ai.service';
import { createLeaveRequestClassifier } from '../agents/leave-request-classifier.agent';
import type { LeaveRequestClassification } from '../agents/leave-request-classifier.schema';
import { formatClassifierInput } from '../utils/classifier-input';
import { planLeaveRequest } from '../utils/leave-plan';
import { ClarificationQualityMetric } from './metrics/clarification-quality.metric';
import {
  type LeaveClassifierMetadata,
  type LeaveClassifierResult,
} from './metrics/leave-classifier-metadata';
import { LeaveIntentMetric } from './metrics/leave-intent.metric';
import { LeaveMarksMetric } from './metrics/leave-marks.metric';

process.loadEnvFile();

// Wednesday 2026-10-07, 09:30 IST.
const EVAL_NOW = new Date('2026-10-07T09:30:00+05:30');
const AUTHOR_ID = 'U0AUTHOR01';
const JUDGE_MODEL = 'kimi-k3';

const aiService = new AiService(new ConfigService());
const classifier = createLeaveRequestClassifier(aiService);
const judge = new AISDKModel({
  model: aiService.model(JUDGE_MODEL),
});

interface LeaveClassifierCase {
  name: string;
  text: string;
  postedAt: string;
  threadParent?: { text: string; postedAt: string };
  expected: LeaveClassifierResult;
  metrics: () => BaseMetric[];
}

const LEAVE_CLASSIFIER_CASES: LeaveClassifierCase[] = [
  {
    name: 'range plus half day',
    text: 'Will be on leave from Oct 19 to 23.\n\nAnd 2nd half leave on Oct 16.\n\ncc @Team',
    postedAt: '2026-10-05T11:30:00+05:30',
    expected: {
      intent: 'mark',
      marks: [
        '2026-10-16 earned second_half',
        '2026-10-19 earned full',
        '2026-10-20 earned full',
        '2026-10-21 earned full',
        '2026-10-22 earned full',
        '2026-10-23 earned full',
      ],
    },
    metrics: () => [new LeaveIntentMetric(), new LeaveMarksMetric()],
  },
  {
    name: 'conditional wfh',
    text: "my car is not starting, will reach by 11.30 if it's battery issue else will do WFH",
    postedAt: '2026-10-07T08:49:00+05:30',
    expected: { intent: 'clarify', marks: [] },
    metrics: () => [
      new LeaveIntentMetric(),
      new ClarificationQualityMetric(judge),
    ],
  },
];

async function runClassifier(
  testCase: LeaveClassifierCase,
): Promise<LLMTestCase> {
  const input = formatClassifierInput({
    now: EVAL_NOW,
    postedAt: new Date(testCase.postedAt),
    authorName: 'Employee',
    authorUserId: AUTHOR_ID,
    text: testCase.text,
    threadParent: testCase.threadParent
      ? {
          text: testCase.threadParent.text,
          postedAt: new Date(testCase.threadParent.postedAt),
        }
      : null,
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
  const metadata: LeaveClassifierMetadata = {
    actual,
    expected: testCase.expected,
  };
  return new LLMTestCase({
    name: testCase.name,
    input,
    actualOutput: JSON.stringify({
      ...actual,
      clarificationQuestion: output.clarificationQuestion,
    }),
    expectedOutput: JSON.stringify(testCase.expected),
    additionalMetadata: metadata,
  });
}

describe('leave request classifier', () => {
  it.each(LEAVE_CLASSIFIER_CASES)('$name', async (testCase) => {
    await expect(await runClassifier(testCase)).toPass(testCase.metrics());
  });
});
