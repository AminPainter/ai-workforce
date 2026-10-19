import { Inject } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { join } from 'path';
import {
  PI_CODING_AGENT,
  REPO_DIR,
  type PiCodingAgent,
} from '../agent/pi-coding.agent';
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
  type CodingTurnJob,
} from '../queues/coding-agent.queue';

@Processor(CODING_AGENT_QUEUE)
export class CodingTurnProcessor extends WorkerHost {
  constructor(
    @Inject(PI_CODING_AGENT)
    private readonly piCodingAgent: PiCodingAgent,
    private readonly codingSessionRepository: CodingSessionRepository,
    private readonly gitWorkspaceService: GitWorkspaceService,
    private readonly gitHubPullRequestService: GitHubPullRequestService,
    @InjectQueue(CODING_AGENT_REPLIES_QUEUE)
    private readonly codingAgentRepliesQueue: Queue<CodingReplyJob>,
  ) {
    super();
  }

  async process(job: Job<CodingTurnJob>): Promise<void> {
    const { threadId, repo, task } = job.data;
    const sessionId = this.codingSessionRepository.sessionId(threadId);
    const rootDir = this.codingSessionRepository.rootDir(sessionId);
    const repoDir = join(rootDir, REPO_DIR);
    const codingSession =
      (await this.codingSessionRepository.find(sessionId)) ??
      (await this.startSession(sessionId, repo, repoDir));

    const harnessSession = await this.piCodingAgent.createSession({
      sessionId,
      sandboxSession: new LocalSandboxSession(rootDir),
      resumeFrom: codingSession.resumeState,
    });
    const { text } = await this.piCodingAgent.generate({
      session: harnessSession,
      prompt: task,
    });
    codingSession.resumeState = await harnessSession.stop();

    await this.gitWorkspaceService.push(
      codingSession.repo,
      repoDir,
      codingSession.branch,
    );
    if (
      !codingSession.pullRequestUrl &&
      (await this.gitWorkspaceService.hasCommitsAhead(
        repoDir,
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
    repoDir: string,
  ): Promise<CodingSession> {
    const branch = `pi/${sessionId}`;
    const baseBranch = await this.gitWorkspaceService.clone(
      repo,
      repoDir,
      branch,
    );
    return { repo, baseBranch, branch };
  }
}
