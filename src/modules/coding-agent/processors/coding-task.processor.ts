import { Inject } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { join } from 'path';
import {
  CODING_AGENT,
  REPO_DIR,
  type CodingAgent,
} from '../agent/coding.agent';
import { LocalSandboxSession } from '../sandbox/local-sandbox-session';
import {
  CodingSessionRepository,
  type CodingSession,
} from '../services/coding-session.repository';
import { GitWorkspaceService } from '../services/git-workspace.service';
import { GitHubPullRequestService } from '../services/github-pull-request.service';
import {
  CODING_AGENT_QUEUE,
  CODING_AGENT_REPLIES_QUEUE,
  type CodingReplyJob,
  type CodingTaskJob,
} from '../queues/coding-agent.queue';

@Processor(CODING_AGENT_QUEUE)
export class CodingTaskProcessor extends WorkerHost {
  constructor(
    @Inject(CODING_AGENT)
    private readonly codingAgent: CodingAgent,
    private readonly codingSessionRepository: CodingSessionRepository,
    private readonly gitWorkspaceService: GitWorkspaceService,
    private readonly gitHubPullRequestService: GitHubPullRequestService,
    @InjectQueue(CODING_AGENT_REPLIES_QUEUE)
    private readonly codingAgentRepliesQueue: Queue<CodingReplyJob>,
  ) {
    super();
  }

  async process(job: Job<CodingTaskJob>): Promise<void> {
    const { threadId, repo, task } = job.data;
    const sessionId = this.codingSessionRepository.sessionId(threadId);
    const rootDir = this.codingSessionRepository.rootDir(sessionId);
    const cloningDirectory = join(rootDir, REPO_DIR);
    const codingSession =
      (await this.codingSessionRepository.find(sessionId)) ??
      (await this.startSession(sessionId, repo, cloningDirectory));

    const harnessSession = await this.codingAgent.createSession({
      sessionId,
      sandboxSession: new LocalSandboxSession(rootDir),
      resumeFrom: codingSession.resumeState,
    });
    const { text } = await this.codingAgent.generate({
      session: harnessSession,
      prompt: task,
    });
    codingSession.resumeState = await harnessSession.stop();

    await this.gitWorkspaceService.push(
      codingSession.repo,
      cloningDirectory,
      codingSession.branch,
    );
    if (
      !codingSession.pullRequestUrl &&
      (await this.gitWorkspaceService.hasCommitsAhead(
        cloningDirectory,
        codingSession.baseBranch,
      ))
    )
      codingSession.pullRequestUrl =
        await this.gitHubPullRequestService.createDraft({
          repo: codingSession.repo,
          head: codingSession.branch,
          base: codingSession.baseBranch,
          title: task.split('\n')[0].slice(0, 72),
          body: text,
        });

    await this.codingSessionRepository.save(sessionId, codingSession);
    await this.codingAgentRepliesQueue.add('reply', {
      threadId,
      text: [text, codingSession.pullRequestUrl].join('\n\n'),
    });
  }

  private async startSession(
    sessionId: string,
    repo: string,
    cloningDirectory: string,
  ): Promise<CodingSession> {
    const branch = `coding-agent/${sessionId}`;
    const baseBranch = await this.gitWorkspaceService.clone(
      repo,
      cloningDirectory,
      branch,
    );
    return { repo, baseBranch, branch };
  }
}
