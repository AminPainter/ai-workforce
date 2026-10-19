/**
 * Standalone harness for the Pi coding agent worker.
 *
 * Boots the worker's providers without BullMQ or Slack and calls
 * CodingTurnProcessor.process directly, printing the Slack reply instead of
 * queueing it. Clone, Pi turn, push and draft PR are all real.
 *
 * Run:
 *   pnpm coding:repl <owner/repo> "<task>" [threadId]
 *
 * Reuse the threadId to send a follow-up turn into the same session.
 *
 * Env required: AI_GATEWAY_BASE_URL, AI_GATEWAY_API_KEY, AI_GATEWAY_MODEL, GITHUB_PAT.
 * CODING_AGENT_WORKSPACES_DIR is optional and defaults to $TMPDIR/coding-agent.
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  PI_CODING_AGENT,
  createPiCodingAgent,
} from '../src/modules/coding-agent/agent/pi-coding.agent';
import { CodingSessionRepository } from '../src/modules/coding-agent/services/coding-session.repository';
import { GitWorkspaceService } from '../src/modules/coding-agent/services/git-workspace.service';
import { GitHubPullRequestService } from '../src/modules/coding-agent/services/github-pull-request.service';
import { CodingTurnProcessor } from '../src/modules/coding-agent/processors/coding-turn.processor';
import {
  CODING_AGENT_REPLIES_QUEUE,
  type CodingReplyJob,
  type CodingTurnJob,
} from '../src/modules/coding-agent/queues/coding-agent.queue';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    {
      provide: PI_CODING_AGENT,
      useFactory: createPiCodingAgent,
      inject: [ConfigService],
    },
    {
      provide: getQueueToken(CODING_AGENT_REPLIES_QUEUE),
      useValue: {
        add: (_name: string, reply: CodingReplyJob) =>
          console.log(`\n--- reply for ${reply.threadId} ---\n${reply.text}`),
      },
    },
    CodingSessionRepository,
    GitWorkspaceService,
    GitHubPullRequestService,
    CodingTurnProcessor,
  ],
})
class ReplModule {}

async function main(): Promise<void> {
  const [repo, task, threadId = `repl-${Date.now()}`] = process.argv.slice(2);
  if (!repo || !task) {
    console.error('Usage: pnpm coding:repl <owner/repo> "<task>" [threadId]');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(ReplModule, {
    logger: ['error', 'warn'],
  });
  const codingSessionRepository = app.get(CodingSessionRepository);
  const sessionId = codingSessionRepository.sessionId(threadId);
  console.log(`threadId:  ${threadId}`);
  console.log(`workspace: ${codingSessionRepository.rootDir(sessionId)}`);
  console.log(`branch:    pi/${sessionId}`);

  await app
    .get(CodingTurnProcessor)
    .process({ data: { threadId, repo, task } } as Job<CodingTurnJob>);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
