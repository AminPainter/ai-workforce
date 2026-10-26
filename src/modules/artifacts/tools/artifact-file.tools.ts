import { tool } from 'ai';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { ArtifactTool } from '../constants/artifact-tools.js';
import {
  ARTIFACT_FILE,
  checkArtifactHtml,
} from '../utils/check-artifact-html.js';

export function createArtifactFileTools(siteDir: string) {
  const artifactPath = join(siteDir, ARTIFACT_FILE);
  let pending: Promise<unknown> = Promise.resolve();
  const inOrder = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = pending.then(operation, operation);
    pending = result.catch(() => undefined);
    return result;
  };
  const readArtifact = () =>
    readFile(artifactPath, 'utf8').catch(() => undefined);

  return {
    [ArtifactTool.WRITE_ARTIFACT]: tool({
      description: `Create or replace ${ARTIFACT_FILE} with the full page.`,
      inputSchema: z.object({
        content: z.string().describe('The complete HTML document.'),
      }),
      execute: ({ content }: { content: string }): Promise<string> =>
        inOrder(async () => {
          await writeFile(artifactPath, content);
          return `Wrote ${ARTIFACT_FILE} (${Buffer.byteLength(content, 'utf8')} bytes).`;
        }),
    }),
    [ArtifactTool.EDIT_ARTIFACT]: tool({
      description: `Change ${ARTIFACT_FILE} by exact-string replacement. The edits apply in order, each to the result of the previous one, and either all apply or none do. Each oldString must appear exactly once.`,
      inputSchema: z.object({
        edits: z
          .array(
            z.object({
              oldString: z.string().min(1),
              newString: z.string(),
            }),
          )
          .min(1),
      }),
      execute: ({
        edits,
      }: {
        edits: { oldString: string; newString: string }[];
      }): Promise<string> =>
        inOrder(async () => {
          const html = await readArtifact();
          if (html === undefined)
            throw new Error(
              `${ARTIFACT_FILE} does not exist yet. Use ${ArtifactTool.WRITE_ARTIFACT} first.`,
            );
          const updated = edits.reduce(
            (content, { oldString, newString }, index) => {
              const occurrences = content.split(oldString).length - 1;
              if (occurrences !== 1)
                throw new Error(
                  `edit ${index + 1}: oldString appears ${occurrences} times, it must appear exactly once. Nothing was changed.`,
                );
              return content.replace(oldString, () => newString);
            },
            html,
          );
          await writeFile(artifactPath, updated);
          return `Applied ${edits.length} edit(s) to ${ARTIFACT_FILE}.`;
        }),
    }),
    [ArtifactTool.CHECK_ARTIFACT]: tool({
      description: `Check ${ARTIFACT_FILE} against the page's Content Security Policy and publishing rules. Call it after your changes, and fix everything it reports before you finish.`,
      inputSchema: z.object({}),
      execute: (): Promise<string> =>
        inOrder(async () => {
          const html = await readArtifact();
          if (html === undefined)
            return `${ARTIFACT_FILE} does not exist yet. Use ${ArtifactTool.WRITE_ARTIFACT} first.`;
          const problems = checkArtifactHtml(html);
          return problems.length > 0
            ? `Fix these problems:\n${problems.map((problem) => `- ${problem}`).join('\n')}`
            : 'No problems found.';
        }),
    }),
  };
}
