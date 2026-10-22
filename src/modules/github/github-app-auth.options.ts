import { ConfigService } from '@nestjs/config';
import type { StrategyOptions } from '@octokit/auth-app';

export function gitHubAppAuthOptions(
  configService: ConfigService,
): StrategyOptions {
  return {
    appId: configService.getOrThrow<string>('GITHUB_APP_ID'),
    privateKey: configService
      .getOrThrow<string>('GITHUB_APP_PRIVATE_KEY')
      .replace(/\\n/g, '\n'),
    installationId: configService.getOrThrow<string>(
      'GITHUB_APP_INSTALLATION_ID',
    ),
  };
}
