import { tool } from 'ai';
import { z } from 'zod';
import { type CodingTaskService } from '../services/coding-task.service.js';

export function createDelegateCodingTaskTool(
  codingTaskService: CodingTaskService,
) {
  return tool({
    description:
      'Hand a code-change task (fix a bug, build a feature, write tests, refactor) to the coding agent. It works on its own branch, commits, opens a draft PR and posts its result in this Slack thread. Calling it again in the same thread continues the same coding session. Returns as soon as the task is queued.',
    inputSchema: z.object({
      repo: z.string().describe('GitHub repository as owner/name.'),
      task: z
        .string()
        .describe(
          'What to change, with all the context from the thread the coding agent needs.',
        ),
    }),
    contextSchema: z.object({ threadId: z.string() }),
    execute: async (
      { repo, task }: { repo: string; task: string },
      { context }: { context: { threadId: string } },
    ): Promise<string> => {
      await codingTaskService.delegate({
        threadId: context.threadId,
        repo,
        task,
      });
      return 'Queued. The coding agent will post its result and PR link in this thread.';
    },
  });
}
