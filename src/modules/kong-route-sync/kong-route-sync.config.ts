import { ConfigService } from '@nestjs/config';

const DEFAULT_SOURCE_REPO = 'glomopay/glomopay_service';
const DEFAULT_TARGET_REPO = 'glomopay/kong';
const DEFAULT_SLACK_CHANNEL = 'C0AJRNHQ7B2';

export function sourceRepo(configService: ConfigService): string {
  return (
    configService.get('KONG_ROUTE_SYNC_SOURCE_REPO') ?? DEFAULT_SOURCE_REPO
  );
}

export function targetRepo(configService: ConfigService): string {
  return (
    configService.get('KONG_ROUTE_SYNC_TARGET_REPO') ?? DEFAULT_TARGET_REPO
  );
}

export function slackChannel(configService: ConfigService): string {
  return (
    configService.get('KONG_ROUTE_SYNC_SLACK_CHANNEL') ?? DEFAULT_SLACK_CHANNEL
  );
}

export function authorDenylist(configService: ConfigService): Set<string> {
  return new Set(
    splitList(configService.get('KONG_ROUTE_SYNC_AUTHOR_DENYLIST')).map(
      (login) => login.toLowerCase(),
    ),
  );
}

export function githubSlackUserMap(
  configService: ConfigService,
): Map<string, string> {
  return new Map(
    splitList(configService.get('GITHUB_SLACK_USER_MAP')).flatMap((entry) => {
      const [login, slackUserId] = entry.split(':').map((part) => part.trim());
      return login && slackUserId
        ? [[login.toLowerCase(), slackUserId] as const]
        : [];
    }),
  );
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
