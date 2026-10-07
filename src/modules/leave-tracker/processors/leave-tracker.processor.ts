import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { SlackBotService } from '../../slack/services/slack-bot.service';
import { toIstDateString } from '../../../common/utils/date.util';
import { LEAVE_REQUEST_CLASSIFIER } from '../agents/leave-request-classifier.agent';
import type { LeaveRequestClassification } from '../agents/leave-request-classifier.schema';
import {
  LEAVE_TRACKER_QUEUE,
  type LeaveMessageJob,
} from '../queues/leave-tracker.queue';
import { LeaveAttendanceService } from '../services/leave-attendance.service';
import { LeaveMessageContextService } from '../services/leave-message-context.service';
import { planLeaveRequest } from '../utils/leave-plan';
import { formatLeaveReply } from '../utils/leave-reply';

const SUCCESS_REACTION = 'white_check_mark';
const PROBLEM_REACTION = 'warning';

@Processor(LEAVE_TRACKER_QUEUE, { concurrency: 1 })
export class LeaveTrackerProcessor extends WorkerHost {
  private readonly logger = new Logger(LeaveTrackerProcessor.name);
  private readonly peoplePartnerUserId: string;

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly leaveMessageContextService: LeaveMessageContextService,
    private readonly leaveAttendanceService: LeaveAttendanceService,
    private readonly slackBotService: SlackBotService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.peoplePartnerUserId = this.configService.getOrThrow<string>(
      'LEAVES_PEOPLE_PARTNER_SLACK_USER_ID',
    );
  }

  async process(job: Job<LeaveMessageJob>): Promise<void> {
    await this.handle(job.data);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<LeaveMessageJob>, error: Error): Promise<void> {
    this.logger.error(`job ${job.id} failed: ${error.message}`);
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    await this.respond(
      job.data,
      `${this.addressee(job.data)} :warning: I couldn't process this message, so nothing was updated in RazorpayX.${this.escalation()}`,
      PROBLEM_REACTION,
    ).catch((replyError: unknown) =>
      this.logger.error(`failed to report job failure: ${String(replyError)}`),
    );
  }

  private async handle(job: LeaveMessageJob): Promise<void> {
    const now = new Date();
    const context = await this.leaveMessageContextService.build(job, now);
    const { output: classification } = (await this.agentRegistry
      .get(LEAVE_REQUEST_CLASSIFIER)
      .generate({
        messages: [{ role: 'user', content: context.classifierInput }],
      })) as { output: LeaveRequestClassification };
    this.logger.log(
      `message ${job.messageId}: ${classification.intent} (${classification.reason})`,
    );

    if (classification.intent === 'ignore') return;
    if (classification.intent === 'clarify')
      return this.askClarification(job, classification);

    const { email } = context.author;
    if (!email) {
      await this.respond(
        job,
        `${this.addressee(job)} :warning: I couldn't read an email address from your Slack profile, so nothing was marked.${this.escalation()}`,
        PROBLEM_REACTION,
      );
      return;
    }

    const today = toIstDateString(now);
    const plan = planLeaveRequest(classification, today);
    const result = await this.leaveAttendanceService.apply({
      email,
      actorSlackUserId: job.userId,
      sourceMessageId: job.messageId,
      today,
      marks: plan.marks,
    });

    const reply = formatLeaveReply({
      addressee: this.addressee(job),
      employeeFound: result.employeeFound,
      outcomes: result.outcomes,
      skipped: plan.skipped,
      invalidRanges: plan.invalidRanges,
      peoplePartnerMention: this.peoplePartnerMention(),
    });
    await this.respond(
      job,
      reply.text,
      reply.hasProblems || !result.employeeFound
        ? PROBLEM_REACTION
        : SUCCESS_REACTION,
    );
  }

  private async askClarification(
    job: LeaveMessageJob,
    classification: LeaveRequestClassification,
  ): Promise<void> {
    const question =
      classification.clarificationQuestion ??
      'Could you confirm the exact dates and whether it is leave or WFH?';
    await this.respond(job, `${this.addressee(job)} ${question}`, null);
  }

  private async respond(
    job: LeaveMessageJob,
    text: string,
    reaction: string | null,
  ): Promise<void> {
    await this.slackBotService.postToThread(job.threadId, text);
    if (reaction)
      await this.slackBotService.addReaction(
        job.threadId,
        job.messageId,
        reaction,
      );
  }

  private addressee(job: LeaveMessageJob): string {
    return `<@${job.userId}>`;
  }

  private peoplePartnerMention(): string {
    return `<@${this.peoplePartnerUserId}>`;
  }

  private escalation(): string {
    return ` ${this.peoplePartnerMention()} please check.`;
  }
}
