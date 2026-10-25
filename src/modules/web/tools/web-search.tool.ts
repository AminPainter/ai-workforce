import { tool } from 'ai';
import { z } from 'zod';

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_TIMEOUT_MS = 10000;

interface SearxngResult {
  url: string;
  title: string;
  content?: string;
}

export function createWebSearchTool(
  baseUrl: string,
  maxResults = DEFAULT_MAX_RESULTS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  return tool({
    description:
      'Search the web via SearXNG. Returns titles, URLs and snippets. Use generic terms — never include customer PII in the query.',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
    }),
    execute: async ({ query }) => {
      const url = new URL('/search', baseUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok)
          return `webSearch failed: ${response.status} ${response.statusText}.`;

        const body = (await response.json()) as { results?: SearxngResult[] };
        const results = (body.results ?? []).slice(0, maxResults).map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content ?? '',
        }));

        return results.length ? results : `No results for "${query}".`;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return `webSearch failed: ${reason}`;
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}
