import { ConfigService } from '@nestjs/config';

const DEFAULT_SOURCE_REPO = 'glomopay/glomopay_service';
const DEFAULT_TARGET_REPO = 'glomopay/kong';

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

export function authorDenylist(configService: ConfigService): Set<string> {
  return new Set(
    splitList(configService.get('KONG_ROUTE_SYNC_AUTHOR_DENYLIST')).map(
      (login) => login.toLowerCase(),
    ),
  );
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
