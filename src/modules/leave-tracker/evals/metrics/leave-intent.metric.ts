import { BaseMetric } from 'deepeval/metrics';
import type { LLMTestCase } from 'deepeval/test-case';
import { metadataOf } from './leave-classifier-metadata.js';

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
