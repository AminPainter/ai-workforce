import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class GitWorkspaceService {
  private readonly githubToken: string;

  constructor(configService: ConfigService) {
    this.githubToken = configService.getOrThrow<string>('GITHUB_PAT');
  }

  async clone(repo: string, repoDir: string, branch: string): Promise<string> {
    await execFileAsync('git', ['clone', this.authenticatedUrl(repo), repoDir]);
    await this.git(
      repoDir,
      'remote',
      'set-url',
      'origin',
      this.publicUrl(repo),
    );
    const baseBranch = await this.git(repoDir, 'branch', '--show-current');
    await this.git(repoDir, 'checkout', '-b', branch);
    return baseBranch;
  }

  async push(repo: string, repoDir: string, branch: string): Promise<void> {
    await this.git(
      repoDir,
      'push',
      this.authenticatedUrl(repo),
      `HEAD:${branch}`,
    );
  }

  async hasCommitsAhead(repoDir: string, baseBranch: string): Promise<boolean> {
    const count = await this.git(
      repoDir,
      'rev-list',
      '--count',
      `${baseBranch}..HEAD`,
    );
    return Number(count) > 0;
  }

  private async git(repoDir: string, ...args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, { cwd: repoDir });
    return stdout.trim();
  }

  private authenticatedUrl(repo: string): string {
    return `https://x-access-token:${this.githubToken}@github.com/${repo}.git`;
  }

  private publicUrl(repo: string): string {
    return `https://github.com/${repo}.git`;
  }
}
