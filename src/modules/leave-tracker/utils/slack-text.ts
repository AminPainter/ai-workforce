const USER_MENTION_PATTERN = /<@([UW][A-Z0-9]+)(?:\|([^>]*))?>/g;
const SUBTEAM_PATTERN = /<!subteam\^[A-Z0-9]+(?:\|([^>]*))?>/g;
const SPECIAL_MENTION_PATTERN = /<!(channel|here|everyone)(?:\|[^>]*)?>/g;
const CHANNEL_LINK_PATTERN = /<#[A-Z0-9]+(?:\|([^>]*))?>/g;
const URL_PATTERN = /<(https?:\/\/[^>|]+)(?:\|([^>]*))?>/g;

export function cleanSlackText(rawText: string): string {
  return rawText
    .replace(
      USER_MENTION_PATTERN,
      (_, id: string, label?: string) => `@${label || id}`,
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
