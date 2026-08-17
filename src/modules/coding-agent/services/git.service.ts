import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitAuth {
  token: string;
}

export interface GitRunOptions {
  cwd?: string;
  auth?: GitAuth;
}

@Injectable()
export class GitService {
  async clone(
    repoUrl: string,
    dir: string,
    branch: string,
    auth: GitAuth,
  ): Promise<void> {
    await this.run(
      ['clone', '--depth', '1', '--branch', branch, repoUrl, dir],
      { auth },
    );
  }

  async run(args: string[], options: GitRunOptions = {}): Promise<string> {
    const authArgs = options.auth ? this.authArgs(options.auth) : [];
    try {
      const { stdout } = await execFileAsync('git', [...authArgs, ...args], {
        cwd: options.cwd,
        maxBuffer: 32 * 1024 * 1024,
      });
      return stdout;
    } catch (error) {
      const stderr =
        typeof (error as { stderr?: unknown }).stderr === 'string'
          ? (error as { stderr: string }).stderr
          : '';
      throw new Error(
        `git ${args.join(' ')} failed: ${this.redact(stderr).slice(0, 500)}`,
      );
    }
  }

  private authArgs(auth: GitAuth): string[] {
    const basic = Buffer.from(`x-access-token:${auth.token}`).toString(
      'base64',
    );
    return ['-c', `http.extraheader=AUTHORIZATION: basic ${basic}`];
  }

  private redact(text: string): string {
    return text.replace(/basic\s+[A-Za-z0-9+/=]+/gi, 'basic ***');
  }
}
