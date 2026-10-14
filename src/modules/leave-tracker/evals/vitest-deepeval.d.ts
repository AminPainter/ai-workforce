import type { BaseMetric } from 'deepeval/metrics';

// deepeval only adds the toPass type to vitest's ESM types, but this CommonJS project
// uses vitest's CommonJS types, so TypeScript can't see toPass without this.
declare module 'vitest' {
  interface Assertion<T> {
    toPass(metrics: BaseMetric[]): Promise<T>;
  }
}
