import { BaseMetric } from 'deepeval/metrics';
import type { LLMTestCase } from 'deepeval/test-case';
import type { LeaveClassifierMetadata } from './leave-classifier-metadata';

export class LeaveMarksMetric extends BaseMetric {
  constructor() {
    super(1);
  }

  measure(testCase: LLMTestCase): number {
    const { actual, expected } =
      testCase.additionalMetadata as LeaveClassifierMetadata;
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
