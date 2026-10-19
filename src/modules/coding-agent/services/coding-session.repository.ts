import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { type HarnessAgentResumeSessionState } from '@ai-sdk/harness/agent';

export interface CodingSession {
  repo: string;
  baseBranch: string;
  branch: string;
  resumeState?: HarnessAgentResumeSessionState;
  pullRequestUrl?: string;
}

@Injectable()
export class CodingSessionRepository {
  private readonly workspacesDir: string;

  constructor(configService: ConfigService) {
    this.workspacesDir =
      configService.get<string>('CODING_AGENT_WORKSPACES_DIR') ??
      join(tmpdir(), 'coding-agent');
  }

  createSessionId(threadId: string): string {
    return createHash('sha256').update(threadId).digest('hex').slice(0, 16);
  }

  getRootDir(sessionId: string): string {
    return join(this.workspacesDir, sessionId);
  }

  async find(sessionId: string): Promise<CodingSession | undefined> {
    return readFile(this.sessionFile(sessionId), 'utf8').then(
      (json) => JSON.parse(json) as CodingSession,
      () => undefined,
    );
  }

  async save(sessionId: string, codingSession: CodingSession): Promise<void> {
    await writeFile(this.sessionFile(sessionId), JSON.stringify(codingSession));
  }

  private sessionFile(sessionId: string): string {
    return join(this.getRootDir(sessionId), 'session.json');
  }
}
