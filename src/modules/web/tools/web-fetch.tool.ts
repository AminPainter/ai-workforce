import { tool } from 'ai';
import { z } from 'zod';
import { convert } from 'html-to-text';

const DEFAULT_MAX_CHARS = 20000;
const DEFAULT_TIMEOUT_MS = 10000;

export function createWebFetchTool(
  maxChars = DEFAULT_MAX_CHARS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  return tool({
    description:
      'Fetch and read the full text of a web page. Pass a URL (e.g. one returned by webSearch).',
    inputSchema: z.object({
      url: z.string().url().describe('The page URL to fetch'),
    }),
    execute: async ({ url }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          headers: { Accept: 'text/html' },
          signal: controller.signal,
        });
        if (!response.ok)
          return `webFetch failed: ${response.status} ${response.statusText} for ${url}.`;

        const text = convert(await response.text(), {
          wordwrap: false,
          selectors: [
            { selector: 'script', format: 'skip' },
            { selector: 'style', format: 'skip' },
            { selector: 'nav', format: 'skip' },
            { selector: 'footer', format: 'skip' },
          ],
        });

        return text.length > maxChars
          ? `${text.slice(0, maxChars)}\n…[truncated]`
          : text;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return `webFetch failed: ${reason}`;
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}
