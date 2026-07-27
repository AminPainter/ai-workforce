import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { SlackNotifierService } from '../../slack/services/slack-notifier.service';
import { CONTRACT_DRIFT_DETECTOR } from '../../agents/workforce/contract-drift-detector/contract-drift-detector.agent';
import type { ContractDriftReport } from '../../agents/workforce/contract-drift-detector/contract-drift-detector.schema';
import {
  CONTRACT_DRIFT_QUEUE,
  type ContractDriftJob,
  type PushPayload,
} from '../queues/contract-drift.queue';

const CONTRACT_DRIFT_CONCURRENCY = Number(
  process.env.CONTRACT_DRIFT_CONCURRENCY ?? 1,
);

@Processor(CONTRACT_DRIFT_QUEUE, { concurrency: CONTRACT_DRIFT_CONCURRENCY })
export class ContractDriftProcessor extends WorkerHost {
  private readonly logger = new Logger(ContractDriftProcessor.name);

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly slackNotifierService: SlackNotifierService,
  ) {
    super();
  }

  async process(job: Job<ContractDriftJob>): Promise<void> {
    const { payload } = job.data;
    const fullName = payload.repository.full_name;
    const shortSha = payload.after.slice(0, 7);
    this.logger.log(`analyzing push to ${fullName}@${shortSha}`);

    const { output } = await this.agentRegistry
      .get(CONTRACT_DRIFT_DETECTOR)
      .generate({
        messages: [{ role: 'user', content: buildTask(payload) }],
      });
    const report = output as ContractDriftReport;

    this.logger.log(
      `Contract drift report for ${fullName}@${shortSha} — hasContractDrift=${report.hasContractDrift}, ${report.driftingChanges.length} change(s):\n${JSON.stringify(report, null, 2)}`,
    );

    if (report.hasContractDrift) {
      await this.slackNotifierService.notifyContractDrift(report, {
        repoFullName: fullName,
        shortSha,
        ref: payload.ref,
        compareUrl: payload.compare,
      });
    }
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

function buildTask(payload: PushPayload): string {
  const commits = payload.commits
    .map((c) => {
      const files = [
        ...(c.added ?? []).map((f) => `+ ${f}`),
        ...(c.modified ?? []).map((f) => `~ ${f}`),
        ...(c.removed ?? []).map((f) => `- ${f}`),
      ].join('\n    ');
      return `- ${c.id}\n  message: ${c.message}\n  files:\n    ${files || '(none listed)'}`;
    })
    .join('\n');

  return [
    `A push landed on ${payload.repository.full_name}.`,
    `ref: ${payload.ref}`,
    `before: ${payload.before}`,
    `after: ${payload.after}`,
    `compare: ${payload.compare}`,
    ``,
    `Commits (${payload.commits.length}):`,
    commits || '(no commit details in payload)',
    ``,
    `Analyze these changes for contract drift and produce your report.`,
  ].join('\n');
}
