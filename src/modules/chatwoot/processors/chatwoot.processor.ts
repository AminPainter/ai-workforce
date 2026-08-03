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
const DRAFT_PREFIX = '[AI draft — review before sending]\n\n';

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

    const conversation = await this.chatwootApiClient
      .getConversation(conversationId)
      .catch((error: Error) => {
        this.logger.warn(
          `could not fetch conversation #${conversationId}, falling back to webhook history: ${error.message}`,
        );
        return undefined;
      });

    const history =
      conversation?.messages ?? payload.conversation.messages ?? [];
    const messages = this.buildModelMessages(history, payload.content ?? '');

    const { text } = await this.agentRegistry
      .get(CUSTOMER_SUPPORT_AGENT)
      .generate({ messages });

    const draft = text.trim();
    if (!draft) {
      this.logger.warn(`empty draft for conversation #${conversationId}`);
      return;
    }

    await this.chatwootApiClient.sendPrivateNote(
      conversationId,
      DRAFT_PREFIX + draft,
    );
    this.logger.log(
      `posted draft note to conversation #${conversationId} (${draft.length} chars)`,
    );

    if ((conversation?.status ?? status) === 'pending')
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
