import type { BaseMetric } from 'deepeval/metrics';

// deepeval/vitest augments vitest's Assertion, which vitest re-exports from
// @vitest/expect, so the augmentation doesn't merge. Matchers does.
declare module 'vitest' {
  interface Matchers<T = any> {
    toPass(metrics: BaseMetric[]): Promise<T>;
  }
}
