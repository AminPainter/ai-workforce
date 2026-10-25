import type { LLMTestCase } from 'deepeval/test-case';
import type { LeaveRequestClassification } from '../../agents/leave-request-classifier.schema.js';

export interface LeaveClassifierResult {
  intent: LeaveRequestClassification['intent'];
  // "YYYY-MM-DD kind portion"; an expected kind of "*" accepts any kind.
  marks: string[];
}

export interface LeaveClassifierMetadata {
  actual: LeaveClassifierResult;
  expected: LeaveClassifierResult;
}

export function metadataOf(testCase: LLMTestCase): LeaveClassifierMetadata {
  return testCase.additionalMetadata as LeaveClassifierMetadata;
}
