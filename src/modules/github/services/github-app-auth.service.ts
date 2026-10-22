import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAppAuth } from '@octokit/auth-app';

@Injectable()
export class GitHubAppAuthService {
  readonly auth: ReturnType<typeof createAppAuth>;

  constructor(configService: ConfigService) {
    this.auth = createAppAuth({
      appId: configService.getOrThrow<string>('GITHUB_APP_ID'),
      privateKey: configService
        .getOrThrow<string>('GITHUB_APP_PRIVATE_KEY')
        .replace(/\\n/g, '\n'),
      installationId: configService.getOrThrow<string>(
        'GITHUB_APP_INSTALLATION_ID',
      ),
    });
  }

  async getInstallationToken(): Promise<string> {
    const { token } = await this.auth({ type: 'installation' });
    return token;
  }
}
