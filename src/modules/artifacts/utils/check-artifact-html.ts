import { ARTIFACT_SCRIPT_URLS } from '../constants/artifact-script-urls.js';

export const ARTIFACT_FILE = 'index.html';
export const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

const ALLOWED_SCRIPT_URLS: string[] = Object.values(ARTIFACT_SCRIPT_URLS);

const SCRIPT_SRC_PATTERN = /<script\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi;

const FORBIDDEN_PATTERNS: [RegExp, string][] = [
  [
    /<(?!a\b|script\b)([a-z]+)\b[^>]*\b(?:src|href|srcset|action|poster)\s*=\s*["']?(?:https?:)?\/\//i,
    'an element loads an external URL (only <a> links and the allowed scripts may point outside)',
  ],
  [/url\(\s*["']?(?:https?:)?\/\//i, 'CSS loads an external URL'],
  [/@import\b/i, 'CSS @import is not allowed'],
  [/<form\b/i, 'forms are not allowed'],
  [
    /<(?:iframe|object|embed)\b/i,
    'iframes, objects and embeds are not allowed',
  ],
  [/\bfetch\s*\(/, 'fetch() is blocked'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest is blocked'],
  [/\b(?:WebSocket|EventSource)\b/, 'WebSocket and EventSource are blocked'],
  [/\bsendBeacon\b/, 'navigator.sendBeacon is blocked'],
  [/\beval\s*\(/, 'eval() is blocked'],
  [/\bnew\s+Function\s*\(/, 'new Function() is blocked'],
  [/\b(?:setTimeout|setInterval)\s*\(\s*["'`]/, 'string timers are blocked'],
  [
    /\b(?:localStorage|sessionStorage|indexedDB)\b|document\.cookie/,
    'storage and cookies throw on this page',
  ],
  [
    /\b(?:alert|confirm)\s*\(|window\.open\s*\(/,
    'dialogs and window.open are not allowed',
  ],
  [
    /\btype\s*:\s*["'](?:time|timeseries)["']/,
    'Chart.js time scales need a date adapter that is not allowed; use category labels',
  ],
];

function lineOf(html: string, index: number): number {
  return html.slice(0, index).split('\n').length;
}

export function checkArtifactHtml(html: string): string[] {
  const problems: string[] = [];
  if (!/^\s*<!doctype html>/i.test(html))
    problems.push('the file must start with <!doctype html>');
  if (!/<\/html>\s*$/i.test(html))
    problems.push('the file must end with </html>');
  if (/\p{Surrogate}/u.test(html) || html.includes('\u0000'))
    problems.push('the file is not valid UTF-8 text');
  const sizeBytes = Buffer.byteLength(html, 'utf8');
  if (sizeBytes > MAX_ARTIFACT_BYTES)
    problems.push(
      `the file is ${sizeBytes} bytes, over the ${MAX_ARTIFACT_BYTES} byte limit`,
    );
  for (const { 1: src, index } of html.matchAll(SCRIPT_SRC_PATTERN))
    if (!ALLOWED_SCRIPT_URLS.includes(src))
      problems.push(
        `line ${lineOf(html, index)}: script src not allowed: ${src}`,
      );
  for (const [pattern, message] of FORBIDDEN_PATTERNS) {
    const match = pattern.exec(html);
    if (match) problems.push(`line ${lineOf(html, match.index)}: ${message}`);
  }
  return problems;
}
