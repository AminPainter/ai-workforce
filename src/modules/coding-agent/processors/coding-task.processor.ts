import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import {
  CODING_AGENT,
  REPO_DIR,
  type CodingAgent,
} from '../agent/coding.agent';
import { LocalSandboxSession } from '../sandbox/local-sandbox-session';
import { CodingSessionRepository } from '../services/coding-session.repository';
import {
  CODING_AGENT_QUEUE,
  CODING_TASK_SLACK_SUMMARY_QUEUE,
  type CodingTaskSlackSummaryJob,
  type CodingTaskJob,
} from '../queues/coding-agent.queue';

@Processor(CODING_AGENT_QUEUE)
export class CodingTaskProcessor extends WorkerHost {
  private readonly githubToken: string;

  constructor(
    @Inject(CODING_AGENT)
    private readonly codingAgent: CodingAgent,
    private readonly codingSessionRepository: CodingSessionRepository,
    @InjectQueue(CODING_TASK_SLACK_SUMMARY_QUEUE)
    private readonly codingTaskSlackSummaryQueue: Queue<CodingTaskSlackSummaryJob>,
    configService: ConfigService,
  ) {
    super();
    this.githubToken = configService.getOrThrow<string>('GITHUB_PAT');
  }

  async process(job: Job<CodingTaskJob>): Promise<void> {
    const { threadId, repo, task } = job.data;
    const sessionId = this.codingSessionRepository.createSessionId(threadId);
    const rootDir = this.codingSessionRepository.getRootDir(sessionId);
    await mkdir(join(rootDir, REPO_DIR), { recursive: true });
    const codingSession = (await this.codingSessionRepository.find(
      sessionId,
    )) ?? { repo };

    const harnessSession = await this.codingAgent.createSession({
      sessionId,
      sandboxSession: new LocalSandboxSession(rootDir, this.githubToken),
      resumeFrom: codingSession.resumeState,
    });
    const { text } = await this.codingAgent.generate({
      session: harnessSession,
      prompt: [
        `Repository: ${codingSession.repo}`,
        `Working branch: coding-agent/${sessionId}`,
        '',
        task,
      ].join('\n'),
    });
    codingSession.resumeState = await harnessSession.stop();

    await this.codingSessionRepository.save(sessionId, codingSession);
    await this.codingTaskSlackSummaryQueue.add('slack-summary', {
      threadId,
      text,
    });
  }
}
