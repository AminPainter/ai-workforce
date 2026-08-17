import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { ContractDriftNotifierService } from '../services/contract-drift-notifier.service';
import { CONTRACT_DRIFT_TRIAGE } from '../agent/contract-drift-triage.agent';
import { CONTRACT_DRIFT_VERIFIER } from '../agent/contract-drift-verifier.agent';
import { CONTRACT_DRIFT_SKEPTIC } from '../agent/contract-drift-skeptic.agent';
import type {
  TriageCandidate,
  TriageResult,
} from '../agent/contract-drift-triage.schema';
import type { VerifierVerdict } from '../agent/contract-drift-verifier.schema';
import type { SkepticVerdict } from '../agent/contract-drift-skeptic.schema';
import type {
  BreakingChange,
  ContractDriftReport,
} from '../agent/contract-drift-detector.schema';
import type { PullRequestMergedPayload } from '../../github/github.events';
import {
  CONTRACT_DRIFT_QUEUE,
  type ContractDriftJob,
} from '../queues/contract-drift.queue';

const CONTRACT_DRIFT_CONCURRENCY = Number(
  process.env.CONTRACT_DRIFT_CONCURRENCY ?? 1,
);
const CONTRACT_DRIFT_VERIFY_CONCURRENCY = Number(
  process.env.CONTRACT_DRIFT_VERIFY_CONCURRENCY ?? 4,
);
const CONTRACT_DRIFT_SKEPTIC_VOTES = Number(
  process.env.CONTRACT_DRIFT_SKEPTIC_VOTES ?? 1,
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
    const prRef = `${fullName}#${prNumber}`;
    this.logger.log(`analyzing PR ${prRef}`);

    const { output: triage } = (await this.agentRegistry
      .get(CONTRACT_DRIFT_TRIAGE)
      .generate({
        messages: [{ role: 'user', content: buildTriageTask(payload) }],
      })) as { output: TriageResult };

    const candidates = triage.candidates.filter(
      (candidate) => candidate.driftType !== 'field-added',
    );
    const fieldAddedDropped = triage.candidates.length - candidates.length;
    this.logger.log(
      `Triage for ${prRef} — ${triage.candidates.length} candidate(s), ${fieldAddedDropped} field-added dropped, ${candidates.length} to verify:\n${JSON.stringify(triage, null, 2)}`,
    );

    // Bounded concurrency: GitHub MCP is shared and rate-limited.
    const verified = await mapWithConcurrency(
      candidates,
      CONTRACT_DRIFT_VERIFY_CONCURRENCY,
      async (candidate) => {
        const { output: verdict } = (await this.agentRegistry
          .get(CONTRACT_DRIFT_VERIFIER)
          .generate({
            messages: [{ role: 'user', content: buildVerifierTask(candidate) }],
          })) as { output: VerifierVerdict };
        return { candidate, verdict };
      },
    );

    const breakingVerified = verified.filter(
      ({ verdict }) => verdict.verdict === 'breaking',
    );
    this.logger.log(
      `Verify for ${prRef} — ${breakingVerified.length}/${candidates.length} verified breaking:\n${JSON.stringify(
        verified.map(({ candidate, verdict }) => ({
          file: candidate.file,
          change: candidate.change,
          verdict: verdict.verdict,
          reason: verdict.reason,
        })),
        null,
        2,
      )}`,
    );

    const survivors = await mapWithConcurrency(
      breakingVerified,
      CONTRACT_DRIFT_VERIFY_CONCURRENCY,
      async ({ candidate, verdict }) => {
        const votes = await Promise.all(
          Array.from({ length: CONTRACT_DRIFT_SKEPTIC_VOTES }, async () => {
            const { output } = (await this.agentRegistry
              .get(CONTRACT_DRIFT_SKEPTIC)
              .generate({
                messages: [
                  {
                    role: 'user',
                    content: buildSkepticTask(candidate, verdict),
                  },
                ],
              })) as { output: SkepticVerdict };
            return output;
          }),
        );
        const refutedCount = votes.filter((vote) => vote.refuted).length;
        const notRefuted = votes.length - refutedCount;
        const survived = notRefuted * 2 > votes.length;
        return { candidate, verdict, votes, survived };
      },
    );

    const refutedCount = survivors.filter(({ survived }) => !survived).length;
    this.logger.log(
      `Skeptic for ${prRef} — ${survivors.length - refutedCount}/${survivors.length} survived (${CONTRACT_DRIFT_SKEPTIC_VOTES} vote(s) each), ${refutedCount} refuted:\n${JSON.stringify(
        survivors.map(({ candidate, votes, survived }) => ({
          file: candidate.file,
          change: candidate.change,
          survived,
          votes: votes.map((vote) => ({
            refuted: vote.refuted,
            reason: vote.reason,
          })),
        })),
        null,
        2,
      )}`,
    );

    const breakingChanges: BreakingChange[] = survivors
      .filter(({ survived }) => survived)
      .map(({ candidate, verdict }) => ({
        file: candidate.file,
        driftType: candidate.driftType,
        change: candidate.change,
        evidence: verdict.evidence,
        reason: verdict.reason,
      }));

    const report: ContractDriftReport = {
      hasBreakingChange: breakingChanges.length > 0,
      summary: buildSummary(triage, {
        candidates: candidates.length,
        fieldAddedDropped,
        verifiedBreaking: breakingVerified.length,
        refutedBySkeptic: refutedCount,
        breaking: breakingChanges.length,
      }),
      breakingChanges,
    };

    this.logger.log(
      `Contract drift report for ${prRef} — hasBreakingChange=${report.hasBreakingChange}, ${breakingChanges.length} breaking change(s):\n${JSON.stringify(report, null, 2)}`,
    );

    if (report.breakingChanges.length > 0)
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

interface StageCounts {
  candidates: number;
  fieldAddedDropped: number;
  verifiedBreaking: number;
  refutedBySkeptic: number;
  breaking: number;
}

function buildSummary(triage: TriageResult, counts: StageCounts): string {
  const stages = `Triage found ${counts.candidates} candidate(s) (${counts.fieldAddedDropped} field-added dropped); ${counts.verifiedBreaking} verified breaking; ${counts.refutedBySkeptic} refuted by skeptic; ${counts.breaking} confirmed.`;
  return triage.notes ? `${stages} ${triage.notes}` : stages;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function buildTriageTask(payload: PullRequestMergedPayload): string {
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
    `Fetch this PR's diff via get_pull_request_files / get_pull_request_diff (PR #${pullRequest.number}), enumerate every in-scope wire-contract candidate, and produce your triage result.`,
  ].join('\n');
}

function buildVerifierTask(candidate: TriageCandidate): string {
  return [
    `Verify ONE candidate drift found in glomopay_service against its glomopay-checkout consumer.`,
    ``,
    `file: ${candidate.file}`,
    `driftType: ${candidate.driftType}`,
    `wireField (camelCase): ${candidate.wireField || '(none)'}`,
    `endpoint segment: ${candidate.endpoint || '(unknown)'}`,
    `change: ${candidate.change}`,
    `backendEvidence: ${candidate.backendEvidence}`,
    ``,
    `Open the consuming code in glomopay-checkout main and return "breaking" only if you can point to the exact line that breaks; otherwise return "cleared".`,
  ].join('\n');
}

function buildSkepticTask(
  candidate: TriageCandidate,
  verdict: VerifierVerdict,
): string {
  return [
    `A verifier claims this is a BREAKING contract change. Independently try to REFUTE it against glomopay-checkout main.`,
    ``,
    `file: ${candidate.file}`,
    `driftType: ${candidate.driftType}`,
    `wireField (camelCase): ${candidate.wireField || '(none)'}`,
    `endpoint segment: ${candidate.endpoint || '(unknown)'}`,
    `change: ${candidate.change}`,
    ``,
    `Verifier evidence: ${verdict.evidence}`,
    `Verifier reason: ${verdict.reason}`,
    ``,
    `Open that artifact yourself. Return refuted:true unless you personally reproduce the exact break.`,
  ].join('\n');
}
