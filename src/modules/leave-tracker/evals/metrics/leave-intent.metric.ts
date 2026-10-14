import { BaseMetric } from 'deepeval/metrics';
import type { LLMTestCase } from 'deepeval/test-case';
import type { LeaveClassifierMetadata } from './leave-classifier-metadata';

export class LeaveIntentMetric extends BaseMetric {
  constructor() {
    super(1);
  }

  measure(testCase: LLMTestCase): number {
    const { actual, expected } =
      testCase.additionalMetadata as LeaveClassifierMetadata;
    this.score = actual.intent === expected.intent ? 1 : 0;
    this.reason = `Expected intent "${expected.intent}", got "${actual.intent}".`;
    this.success = this.isSuccessful();
    return this.score;
  }

  get name(): string {
    return 'Leave Intent';
  }
}
