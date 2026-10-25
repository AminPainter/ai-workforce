import { tool } from 'ai';
import { z } from 'zod';
import { type ArtifactRequestService } from '../services/artifact-request.service.js';
import {
  type ArtifactScanFinding,
  type ArtifactScannerService,
} from '../services/artifact-scanner.service.js';

const MAX_TITLE_LENGTH = 120;
const MAX_BRIEF_LENGTH = 100_000;

export function createRequestArtifactTool(
  artifactRequestService: ArtifactRequestService,
  artifactScannerService: ArtifactScannerService,
) {
  return tool({
    description:
      'Publish a self-contained HTML page (an artifact) built from a brief, and post its link in this Slack thread. Call it only when the person explicitly asks for an artifact, page, or link in their own words. Never offer one, and never call it because an answer is long or visual. Anyone with the link can open the page. A separate model with no tools and no data access writes the page from the brief alone. Returns as soon as the request is queued.',
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
          'Everything the page needs: purpose, layout, sections, charts, and all the data as aggregates. No per-customer rows (even masked), no card, Aadhaar, PAN, or account numbers, no secrets.',
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
      const blocked = [
        ...describeFindings(
          'the title',
          artifactScannerService.scan(title).blocked,
        ),
        ...describeFindings(
          'the brief',
          artifactScannerService.scan(brief).blocked,
        ),
      ];
      if (blocked.length > 0)
        return `Blocked. Nothing was queued. Found: ${blocked.join(', ')}. Remove these values, use aggregates only, and call requestArtifact again.`;

      await artifactRequestService.request({
        threadId: context.threadId,
        requesterUserId: context.requesterUserId,
        title,
        brief,
      });
      return 'Queued. The artifact will be posted in this thread.';
    },
  });
}

function describeFindings(
  source: string,
  findings: ArtifactScanFinding[],
): string[] {
  return [
    ...new Set(
      findings.map(({ type, line }) => `${type} at line ${line} of ${source}`),
    ),
  ];
}
