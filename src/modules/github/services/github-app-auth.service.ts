import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAppAuth } from '@octokit/auth-app';
import { gitHubAppAuthOptions } from '../github-app-auth.options';

@Injectable()
export class GitHubAppAuthService {
  private readonly auth: ReturnType<typeof createAppAuth>;

  constructor(configService: ConfigService) {
    this.auth = createAppAuth(gitHubAppAuthOptions(configService));
  }

  async getInstallationToken(): Promise<string> {
    const { token } = await this.auth({ type: 'installation' });
    return token;
  }
}
