import { ConfigService } from '@nestjs/config';

export const SOURCE_REPO = 'glomopay/glomopay_service';
export const TARGET_REPO = 'glomopay/kong';

export function authorDenylist(configService: ConfigService): Set<string> {
  return new Set(
    splitList(configService.get('KONG_ROUTE_SYNC_AUTHOR_DENYLIST')).map(
      (username) => username.toLowerCase(),
    ),
  );
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
