import { tool } from 'ai';
import { z } from 'zod';
import { type ArtifactRequestService } from '../services/artifact-request.service.js';

const MAX_TITLE_LENGTH = 120;
const MAX_BRIEF_LENGTH = 100_000;

export function createRequestArtifactTool(
  artifactRequestService: ArtifactRequestService,
) {
  return tool({
    description:
      'Publish a self-contained HTML page (an artifact) built from a brief, and post its link in this Slack thread. Call it only when the person explicitly asks for an artifact, page, or link in their own words. Never offer one, and never call it because an answer is long or visual. Anyone with the link can open the page. A coding agent with no data access builds the page from the brief alone, which takes a few minutes. In a thread that already has an artifact, calling it again revises that page at the same link: put the requested change and any new data in the brief. Returns as soon as the request is queued.',
    inputSchema: z.object({
      title: z
        .string()
        .min(1)
        .max(MAX_TITLE_LENGTH)
        .describe('Page title, shown as the heading and in the Slack post.'),
      brief: z
        .string()
        .min(1)
        .max(MAX_BRIEF_LENGTH)
        .describe(
          'For a new page: everything it needs, meaning purpose, layout, sections, charts, and all the data as aggregates. For a revision: the change to make and any new data. No per-customer rows (even masked), no card, Aadhaar, PAN, or account numbers, no secrets.',
        ),
    }),
    contextSchema: z.object({
      threadId: z.string(),
      requesterUserId: z.string(),
    }),
    execute: async (
      { title, brief }: { title: string; brief: string },
      { context }: { context: { threadId: string; requesterUserId: string } },
    ): Promise<string> => {
      const { revising } = await artifactRequestService.request({
        threadId: context.threadId,
        requesterUserId: context.requesterUserId,
        title,
        brief,
      });
      return revising
        ? 'Queued a revision of the artifact in this thread. The updated link will be posted in this thread.'
        : 'Queued. The artifact will be posted in this thread.';
    },
  });
}
