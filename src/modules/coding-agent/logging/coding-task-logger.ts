import { Logger } from '@nestjs/common';

const HEARTBEAT_INTERVAL_MS = 60_000;
const PREVIEW_LENGTH = 300;

interface StepStartEvent {
  stepNumber: number;
}

interface StepEndEvent {
  stepNumber: number;
  finishReason: string;
  text: string;
  toolCalls: ReadonlyArray<{ toolName: string }>;
  usage: { inputTokens?: number; outputTokens?: number };
}

interface ToolExecutionStartEvent {
  toolCall: { toolCallId: string; toolName: string; input: unknown };
}

interface ToolExecutionEndEvent {
  toolCall: { toolCallId: string; toolName: string };
  toolExecutionMs: number;
  toolOutput:
    | { type: 'tool-result'; output: unknown }
    | { type: 'tool-error'; error: unknown };
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m${seconds % 60}s`;
}

export class CodingTaskLogger {
  private readonly logger = new Logger('CodingTask');
  private readonly startedAt = Date.now();
  private lastActivity = 'started';
  private lastActivityAt = Date.now();
  private stepCount = 0;
  private heartbeat?: NodeJS.Timeout;

  constructor(
    private readonly prefix: string,
    private readonly secrets: string[],
  ) {}

  log(message: string): void {
    this.logger.log(this.format(message));
  }

  debug(message: string): void {
    this.logger.debug(this.format(message));
  }

  warn(message: string): void {
    this.logger.warn(this.format(message));
  }

  error(message: string, error?: unknown): void {
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(this.format(message), stack && this.redact(stack));
  }

  preview(value: unknown): string {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const flattened = this.redact(text ?? String(value))
      .replace(/\s+/g, ' ')
      .trim();
    return flattened.length > PREVIEW_LENGTH
      ? `${flattened.slice(0, PREVIEW_LENGTH)}…`
      : flattened;
  }

  elapsed(): string {
    return formatDuration(Date.now() - this.startedAt);
  }

  startHeartbeat(runningCommands: () => string[]): void {
    this.heartbeat = setInterval(() => {
      const commands = runningCommands();
      this.log(
        [
          `still working after ${this.elapsed()}`,
          `${this.stepCount} steps`,
          `last activity ${formatDuration(Date.now() - this.lastActivityAt)} ago: ${this.lastActivity}`,
          ...(commands.length ? [`running: ${commands.join(' | ')}`] : []),
        ].join(', '),
      );
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeat.unref();
  }

  stopHeartbeat(): void {
    clearInterval(this.heartbeat);
  }

  readonly onStepStart = ({ stepNumber }: StepStartEvent): void => {
    this.touch(`step ${stepNumber} model call`);
    this.log(`step ${stepNumber} started, waiting for the model`);
  };

  readonly onStepEnd = (step: StepEndEvent): void => {
    this.stepCount += 1;
    this.touch(`step ${step.stepNumber} finished`);
    const tools = step.toolCalls.map(({ toolName }) => toolName).join(', ');
    this.log(
      [
        `step ${step.stepNumber} finished (${step.finishReason})`,
        `tokens in/out ${step.usage.inputTokens ?? '?'}/${step.usage.outputTokens ?? '?'}`,
        ...(tools ? [`tools: ${tools}`] : []),
        ...(step.text ? [`text: ${this.preview(step.text)}`] : []),
      ].join(', '),
    );
  };

  readonly onToolExecutionStart = ({
    toolCall,
  }: ToolExecutionStartEvent): void => {
    this.touch(`tool ${toolCall.toolName}`);
    this.log(
      `tool ${toolCall.toolName} [${toolCall.toolCallId}] started: ${this.preview(toolCall.input)}`,
    );
  };

  readonly onToolExecutionEnd = ({
    toolCall,
    toolExecutionMs,
    toolOutput,
  }: ToolExecutionEndEvent): void => {
    this.touch(`tool ${toolCall.toolName} finished`);
    const summary = `tool ${toolCall.toolName} [${toolCall.toolCallId}] ${toolOutput.type === 'tool-error' ? 'failed' : 'finished'} in ${formatDuration(toolExecutionMs)}`;
    if (toolOutput.type === 'tool-error')
      this.warn(`${summary}: ${this.preview(String(toolOutput.error))}`);
    else this.log(`${summary}: ${this.preview(toolOutput.output)}`);
  };

  private touch(activity: string): void {
    this.lastActivity = activity;
    this.lastActivityAt = Date.now();
  }

  private format(message: string): string {
    return `[${this.prefix}] ${this.redact(message)}`;
  }

  private redact(text: string): string {
    return this.secrets.reduce(
      (redacted, secret) => redacted.split(secret).join('[redacted]'),
      text,
    );
  }
}
