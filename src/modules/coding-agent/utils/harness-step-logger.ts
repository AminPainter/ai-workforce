import { type Logger } from '@nestjs/common';

const PREVIEW_LENGTH = 300;
const GITHUB_TOKEN_PATTERN = /ghs_[\w.-]+/g;

export function redactSecrets(text: string): string {
  return text.replace(GITHUB_TOKEN_PATTERN, '[redacted]');
}

export function previewForLog(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return redactSecrets(text ?? '')
    .replace(/\s+/g, ' ')
    .slice(0, PREVIEW_LENGTH);
}

export function harnessStepLogging(logger: Logger) {
  return {
    onStepStart: ({ stepNumber }: { stepNumber: number }) =>
      logger.log(`step ${stepNumber}: waiting for the model`),
    onStepEnd: ({
      stepNumber,
      finishReason,
      text,
    }: {
      stepNumber: number;
      finishReason: string;
      text: string;
    }) =>
      logger.log(
        `step ${stepNumber} done (${finishReason}): ${previewForLog(text)}`,
      ),
    onToolExecutionStart: ({
      toolCall,
    }: {
      toolCall: { toolName: string; input: unknown };
    }) =>
      logger.log(
        `${toolCall.toolName} started: ${previewForLog(toolCall.input)}`,
      ),
    onToolExecutionEnd: ({
      toolCall,
      toolOutput,
      toolExecutionMs,
    }: {
      toolCall: { toolName: string };
      toolOutput: { type: string; output?: unknown; error?: unknown };
      toolExecutionMs: number;
    }) =>
      logger.log(
        `${toolCall.toolName} ${toolOutput.type === 'tool-error' ? 'failed' : 'done'} in ${toolExecutionMs}ms: ${previewForLog(toolOutput.type === 'tool-error' ? String(toolOutput.error) : toolOutput.output)}`,
      ),
  };
}
