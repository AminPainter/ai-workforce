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

  async clone(
    repo: string,
    cloningDirectory: string,
    branch: string,
  ): Promise<string> {
    await execFileAsync('git', [
      'clone',
      this.authenticatedUrl(repo),
      cloningDirectory,
    ]);
    await this.git(
      cloningDirectory,
      'remote',
      'set-url',
      'origin',
      this.publicUrl(repo),
    );
    const baseBranch = await this.git(
      cloningDirectory,
      'branch',
      '--show-current',
    );
    await this.git(cloningDirectory, 'checkout', '-b', branch);
    return baseBranch;
  }

  async push(
    repo: string,
    cloningDirectory: string,
    branch: string,
  ): Promise<void> {
    await this.git(
      cloningDirectory,
      'push',
      this.authenticatedUrl(repo),
      `HEAD:${branch}`,
    );
  }

  async hasCommitsAhead(
    cloningDirectory: string,
    baseBranch: string,
  ): Promise<boolean> {
    const count = await this.git(
      cloningDirectory,
      'rev-list',
      '--count',
      `${baseBranch}..HEAD`,
    );
    return Number(count) > 0;
  }

  private async git(
    cloningDirectory: string,
    ...args: string[]
  ): Promise<string> {
    const { stdout } = await execFileAsync('git', args, {
      cwd: cloningDirectory,
    });
    return stdout.trim();
  }

  private authenticatedUrl(repo: string): string {
    return `https://x-access-token:${this.githubToken}@github.com/${repo}.git`;
  }

  private publicUrl(repo: string): string {
    return `https://github.com/${repo}.git`;
  }
}
