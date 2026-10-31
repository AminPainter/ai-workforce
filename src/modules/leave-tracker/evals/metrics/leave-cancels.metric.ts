import { BaseMetric } from 'deepeval/metrics';
import type { LLMTestCase } from 'deepeval/test-case';
import { metadataOf } from './leave-classifier-metadata.js';

export class LeaveCancelsMetric extends BaseMetric {
  constructor() {
    super(1);
  }

  measure(testCase: LLMTestCase): number {
    const { actual, expected } = metadataOf(testCase);
    const unmatched = [...actual.cancels];
    const missing: string[] = [];
    for (const want of expected.cancels) {
      const index = unmatched.findIndex((got) => cancelMatches(got, want));
      if (index === -1) missing.push(want);
      else unmatched.splice(index, 1);
    }

    const matched = expected.cancels.length - missing.length;
    const precision = actual.cancels.length
      ? matched / actual.cancels.length
      : 1;
    const recall = expected.cancels.length
      ? matched / expected.cancels.length
      : 1;
    this.score =
      precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);
    this.reason =
      missing.length || unmatched.length
        ? `Missing: ${JSON.stringify(missing)}. Unexpected: ${JSON.stringify(unmatched)}.`
        : 'All planned cancellations match.';
    this.success = this.isSuccessful();
    return this.score;
  }

  get name(): string {
    return 'Leave Cancels';
  }
}

function cancelMatches(got: string, want: string): boolean {
  const [gotDate, gotKind] = got.split(' ');
  const [wantDate, wantKind] = want.split(' ');
  return gotDate === wantDate && (wantKind === '*' || gotKind === wantKind);
}
