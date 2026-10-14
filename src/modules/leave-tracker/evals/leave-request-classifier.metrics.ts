import { BaseMetric, GEval } from 'deepeval/metrics';
import type { DeepEvalBaseLLM } from 'deepeval/models';
import { type LLMTestCase, SingleTurnParams } from 'deepeval/test-case';
import type { LeaveRequestClassification } from '../agents/leave-request-classifier.schema';

export interface LeaveClassifierResult {
  intent: LeaveRequestClassification['intent'];
  // "YYYY-MM-DD kind portion"; an expected kind of "*" accepts any kind.
  marks: string[];
}

export interface LeaveClassifierMetadata {
  actual: LeaveClassifierResult;
  expected: LeaveClassifierResult;
}

function metadataOf(testCase: LLMTestCase): LeaveClassifierMetadata {
  return testCase.additionalMetadata as LeaveClassifierMetadata;
}

export class LeaveIntentMetric extends BaseMetric {
  constructor() {
    super(1);
  }

  measure(testCase: LLMTestCase): number {
    const { actual, expected } = metadataOf(testCase);
    this.score = actual.intent === expected.intent ? 1 : 0;
    this.reason = `Expected intent "${expected.intent}", got "${actual.intent}".`;
    this.success = this.isSuccessful();
    return this.score;
  }

  get name(): string {
    return 'Leave Intent';
  }
}

export class LeaveMarksMetric extends BaseMetric {
  constructor() {
    super(1);
  }

  measure(testCase: LLMTestCase): number {
    const { actual, expected } = metadataOf(testCase);
    const unmatched = [...actual.marks];
    const missing: string[] = [];
    for (const want of expected.marks) {
      const index = unmatched.findIndex((got) => markMatches(got, want));
      if (index === -1) missing.push(want);
      else unmatched.splice(index, 1);
    }

    const matched = expected.marks.length - missing.length;
    const precision = actual.marks.length ? matched / actual.marks.length : 1;
    const recall = expected.marks.length ? matched / expected.marks.length : 1;
    this.score =
      precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);
    this.reason =
      missing.length || unmatched.length
        ? `Missing: ${JSON.stringify(missing)}. Unexpected: ${JSON.stringify(unmatched)}.`
        : 'All planned marks match.';
    this.success = this.isSuccessful();
    return this.score;
  }

  get name(): string {
    return 'Leave Marks';
  }
}

function markMatches(got: string, want: string): boolean {
  const [gotDate, gotKind, gotPortion] = got.split(' ');
  const [wantDate, wantKind, wantPortion] = want.split(' ');
  return (
    gotDate === wantDate &&
    gotPortion === wantPortion &&
    (wantKind === '*' || gotKind === wantKind)
  );
}

export function createClarificationQualityMetric(
  judge: DeepEvalBaseLLM,
): GEval {
  return new GEval({
    name: 'Clarification Quality',
    model: judge,
    threshold: 0.7,
    evaluationParams: [SingleTurnParams.INPUT, SingleTurnParams.ACTUAL_OUTPUT],
    evaluationSteps: [
      'Context: the input is a Slack message from an employee in the #leaves channel. The bot\'s only job is to mark the author\'s leave or work-from-home (WFH) days in payroll. It asks a clarification question when the message is conditional or vague about dates or type. The actual output is JSON whose "clarificationQuestion" is what the bot posts back in the thread; judge only that question.',
      'Check the question targets the specific uncertainty in the message (e.g. which of two conditional outcomes happened, which exact dates, full or half day, leave or WFH) and does not ask for anything the message already states. Asking whether to mark a day as leave or WFH is expected and fine.',
      'Check it is a single short question addressed to the author, in plain conversational language.',
      'Penalize any promise of actions beyond marking leave or WFH, such as cancelling leave, showing leave balances or approving leave.',
      'Penalize internal or technical terms such as RazorpayX, leave-type codes, intents, JSON or schema field names.',
      'Penalize any mention or repetition of health or personal details from the message.',
    ],
  });
}
