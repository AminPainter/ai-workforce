const USER_MENTION_PATTERN = /<@([UW][A-Z0-9]+)(?:\|([^>]*))?>/g;
const SUBTEAM_PATTERN = /<!subteam\^[A-Z0-9]+(?:\|([^>]*))?>/g;
const SPECIAL_MENTION_PATTERN = /<!(channel|here|everyone)(?:\|[^>]*)?>/g;
const CHANNEL_LINK_PATTERN = /<#[A-Z0-9]+(?:\|([^>]*))?>/g;
const URL_PATTERN = /<(https?:\/\/[^>|]+)(?:\|([^>]*))?>/g;
const PERMALINK_PATTERN =
  /https?:\/\/[\w.-]+\.slack\.com\/archives\/([A-Z0-9]+)\/p(\d{10})(\d{6})(?:\?[^\s>|]*?thread_ts=(\d+\.\d+))?/g;

export interface SlackPermalink {
  channelId: string;
  ts: string;
  threadTs: string;
}

export function extractMentionedUserIds(rawText: string): string[] {
  return [
    ...new Set([...rawText.matchAll(USER_MENTION_PATTERN)].map(([, id]) => id)),
  ];
}

export function extractPermalinks(
  rawText: string,
  channelId: string,
): SlackPermalink[] {
  return [...rawText.matchAll(PERMALINK_PATTERN)]
    .filter(([, linkChannelId]) => linkChannelId === channelId)
    .map(([, linkChannelId, seconds, micros, threadTs]) => {
      const ts = `${seconds}.${micros}`;
      return { channelId: linkChannelId, ts, threadTs: threadTs ?? ts };
    });
}

export function cleanSlackText(
  rawText: string,
  userNames: Map<string, string>,
): string {
  return rawText
    .replace(
      USER_MENTION_PATTERN,
      (_, id: string, label?: string) => `@${label || userNames.get(id) || id}`,
    )
    .replace(SUBTEAM_PATTERN, (_, label?: string) => (label ? label : ''))
    .replace(SPECIAL_MENTION_PATTERN, (_, name: string) => `@${name}`)
    .replace(CHANNEL_LINK_PATTERN, (_, label?: string) =>
      label ? `#${label}` : '#channel',
    )
    .replace(URL_PATTERN, (_, url: string, label?: string) =>
      label && label !== url ? `${label} (${url})` : url,
    )
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
