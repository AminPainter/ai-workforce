import { ARTIFACT_SCRIPT_URLS } from './artifact-script-urls.js';

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  `script-src 'unsafe-inline' ${Object.values(ARTIFACT_SCRIPT_URLS).join(' ')}`,
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com data:',
  'img-src data: blob:',
  "media-src 'none'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "manifest-src 'none'",
  "frame-ancestors 'none'",
  'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox',
].join('; ');

export const ARTIFACT_RESPONSE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': CONTENT_SECURITY_POLICY,
  'x-robots-tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=()',
  'cache-control': 'no-store',
} as const;
