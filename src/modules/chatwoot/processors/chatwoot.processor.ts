import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { ChatwootApiClient } from '../services/chatwoot-api.client';
import { CUSTOMER_SUPPORT_AGENT } from '../agent/customer-support-agent.agent';
import {
  CHATWOOT_QUEUE,
  type ChatwootDraftJob,
} from '../queues/chatwoot.queue';

const CHATWOOT_CONCURRENCY = Number(process.env.CHATWOOT_CONCURRENCY ?? 3);
const DRAFT_PREFIX =
  '[AI support note — internal issue summary + a suggested reply. Send only the SUGGESTED REPLY to the customer, after review.]\n\n';
const NEEDS_HUMAN_PREFIX =
  '[AI escalation — needs human/compliance review]\n\n';
const NEEDS_HUMAN_SENTINEL = 'NEEDS HUMAN:';
const NO_DRAFT_PATTERN = /^no draft\.?$/i;

type ConversationMessage = {
  content?: string | null;
  message_type?: string | number;
  private?: boolean;
};
type ModelMessage = { role: 'user' | 'assistant'; content: string };

@Processor(CHATWOOT_QUEUE, { concurrency: CHATWOOT_CONCURRENCY })
export class ChatwootProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatwootProcessor.name);
  private readonly maxContextMessages: number;

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly chatwootApiClient: ChatwootApiClient,
    private readonly configService: ConfigService,
  ) {
    super();
    this.maxContextMessages = Number(
      this.configService.get('CHATWOOT_MAX_CONTEXT_MESSAGES') ?? 50,
    );
  }

  async process(job: Job<ChatwootDraftJob>): Promise<void> {
    const { conversationId, status, payload } = job.data;

    const [history, conversation] = await Promise.all([
      this.chatwootApiClient
        .getConversationMessages(conversationId)
        .catch((error: Error) => {
          this.logger.warn(
            `could not fetch messages for conversation #${conversationId}, falling back to webhook history: ${error.message}`,
          );
          return undefined;
        }),
      this.chatwootApiClient
        .getConversation(conversationId)
        .catch(() => undefined),
    ]);

    const messages = this.buildModelMessages(
      history ?? payload.conversation.messages ?? [],
      payload.content ?? '',
    );

    const { text } = await this.agentRegistry
      .get(CUSTOMER_SUPPORT_AGENT)
      .generate({ messages });

    const output = text.trim();
    if (!output) {
      this.logger.warn(`empty draft for conversation #${conversationId}`);
      return;
    }

    if (NO_DRAFT_PATTERN.test(output)) {
      this.logger.log(
        `no substantive reply needed for conversation #${conversationId}, skipping note`,
      );
      return;
    }

    const needsHuman = output.startsWith(NEEDS_HUMAN_SENTINEL);

    await this.chatwootApiClient.sendPrivateNote(
      conversationId,
      (needsHuman ? NEEDS_HUMAN_PREFIX : DRAFT_PREFIX) + output,
    );
    this.logger.log(
      `posted ${needsHuman ? 'escalation' : 'draft'} note to conversation #${conversationId} (${output.length} chars)`,
    );

    if (needsHuman || (conversation?.status ?? status) === 'pending')
      await this.chatwootApiClient.handoffToHuman(conversationId);
  }

  private buildModelMessages(
    history: ConversationMessage[],
    latest: string,
  ): ModelMessage[] {
    const mapped: ModelMessage[] = history
      .filter(
        (message) =>
          message.private !== true && (message.content ?? '').trim().length > 0,
      )
      .slice(-this.maxContextMessages)
      .map((message) => ({
        role: this.roleFor(message.message_type),
        content: message.content ?? '',
      }));

    if (mapped.length === 0 && latest.trim().length > 0)
      mapped.push({ role: 'user', content: latest });

    return [{ role: 'user', content: this.datePrefix() }, ...mapped];
  }

  private roleFor(
    messageType: string | number | undefined,
  ): 'user' | 'assistant' {
    return messageType === 'incoming' || messageType === 0
      ? 'user'
      : 'assistant';
  }

  private datePrefix(): string {
    const now = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
    return `Current date/time: ${now} IST`;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.error(`job ${job.id} failed: ${err.message}`);
  }
}
