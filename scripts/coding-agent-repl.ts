/**
 * Standalone harness for the coding agent worker.
 *
 * Boots the worker's providers without BullMQ or Slack and calls
 * CodingTaskProcessor.process directly, printing the Slack summary instead of
 * queueing it. The agent clones, pushes and opens the draft PR for real.
 *
 * Run:
 *   pnpm coding:repl <owner/repo> "<task>" [threadId]
 *
 * Reuse the threadId to send a follow-up task into the same session.
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
  CODING_AGENT,
  createCodingAgent,
} from '../src/modules/coding-agent/agent/coding.agent';
import { CodingSessionRepository } from '../src/modules/coding-agent/services/coding-session.repository';
import { CodingTaskProcessor } from '../src/modules/coding-agent/processors/coding-task.processor';
import {
  CODING_TASK_SLACK_SUMMARY_QUEUE,
  type CodingTaskSlackSummaryJob,
  type CodingTaskJob,
} from '../src/modules/coding-agent/queues/coding-agent.queue';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    {
      provide: CODING_AGENT,
      useFactory: createCodingAgent,
      inject: [ConfigService],
    },
    {
      provide: getQueueToken(CODING_TASK_SLACK_SUMMARY_QUEUE),
      useValue: {
        add: (_name: string, summary: CodingTaskSlackSummaryJob) =>
          console.log(
            `\n--- Slack summary for ${summary.threadId} ---\n${summary.text}`,
          ),
      },
    },
    CodingSessionRepository,
    CodingTaskProcessor,
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
  const sessionId = codingSessionRepository.createSessionId(threadId);
  console.log(`threadId:  ${threadId}`);
  console.log(`workspace: ${codingSessionRepository.getRootDir(sessionId)}`);
  console.log(`branch:    coding-agent/${sessionId}`);

  await app
    .get(CodingTaskProcessor)
    .process({ data: { threadId, repo, task } } as Job<CodingTaskJob>);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
