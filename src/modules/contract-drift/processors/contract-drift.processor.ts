import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { ContractDriftNotifierService } from '../services/contract-drift-notifier.service';
import { CONTRACT_DRIFT_DETECTOR } from '../agent/contract-drift-detector.agent';
import type { ContractDriftReport } from '../agent/contract-drift-detector.schema';
import type { PullRequestMergedPayload } from '../../github/github.events';
import {
  CONTRACT_DRIFT_QUEUE,
  type ContractDriftJob,
} from '../queues/contract-drift.queue';

const CONTRACT_DRIFT_CONCURRENCY = Number(
  process.env.CONTRACT_DRIFT_CONCURRENCY ?? 1,
);

@Processor(CONTRACT_DRIFT_QUEUE, { concurrency: CONTRACT_DRIFT_CONCURRENCY })
export class ContractDriftProcessor extends WorkerHost {
  private readonly logger = new Logger(ContractDriftProcessor.name);

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly contractDriftNotifierService: ContractDriftNotifierService,
  ) {
    super();
  }

  async process(job: Job<ContractDriftJob>): Promise<void> {
    const { payload } = job.data;
    const pullRequest = payload.pull_request;
    const fullName = payload.repository.full_name;
    const prNumber = pullRequest.number;
    const mergeSha = pullRequest.merge_commit_sha ?? '';
    this.logger.log(`analyzing PR ${fullName}#${prNumber}`);

    const { output } = await this.agentRegistry
      .get(CONTRACT_DRIFT_DETECTOR)
      .generate({
        messages: [{ role: 'user', content: buildTask(payload) }],
      });
    const report = output as ContractDriftReport;

    this.logger.log(
      `Contract drift report for ${fullName}#${prNumber} — hasContractDrift=${report.hasContractDrift}, ${report.driftingChanges.length} change(s):\n${JSON.stringify(report, null, 2)}`,
    );

    if (report.hasContractDrift)
      await this.contractDriftNotifierService.notifyContractDrift(report, {
        repoFullName: fullName,
        prNumber,
        mergeSha: mergeSha.slice(0, 7),
        baseRef: pullRequest.base.ref,
        prUrl: pullRequest.html_url,
      });
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

function buildTask(payload: PullRequestMergedPayload): string {
  const pullRequest = payload.pull_request;

  return [
    `A pull request was merged into ${pullRequest.base.ref} on ${payload.repository.full_name}.`,
    `PR: #${pullRequest.number} — ${pullRequest.title}`,
    `base: ${pullRequest.base.ref}`,
    `head: ${pullRequest.head.ref}`,
    `merge commit: ${pullRequest.merge_commit_sha ?? '(unknown)'}`,
    `url: ${pullRequest.html_url}`,
    `changed files: ${pullRequest.changed_files}, +${pullRequest.additions}/-${pullRequest.deletions}`,
    ``,
    `Description:`,
    pullRequest.body?.trim() || '(no description)',
    ``,
    `Fetch this PR's diff via get_pull_request_files / get_pull_request_diff (PR #${pullRequest.number}), analyze the changes for contract drift, and produce your report.`,
  ].join('\n');
}
