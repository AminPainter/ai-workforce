import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { type HarnessAgentResumeSessionState } from '@ai-sdk/harness/agent';

export interface ArtifactSession {
  resumeState?: HarnessAgentResumeSessionState;
}

@Injectable()
export class ArtifactSessionRepository {
  private readonly workspacesDir: string;

  constructor(configService: ConfigService) {
    this.workspacesDir = join(
      configService.get<string>('CODING_AGENT_WORKSPACES_DIR') ??
        join(tmpdir(), 'coding-agent'),
      'artifacts',
    );
  }

  createSessionId(threadId: string): string {
    return createHash('sha256')
      .update(`artifact:${threadId}`)
      .digest('hex')
      .slice(0, 16);
  }

  getRootDir(sessionId: string): string {
    return join(this.workspacesDir, sessionId);
  }

  async find(sessionId: string): Promise<ArtifactSession | undefined> {
    return readFile(this.sessionFile(sessionId), 'utf8').then(
      (json) => JSON.parse(json) as ArtifactSession,
      () => undefined,
    );
  }

  async save(
    sessionId: string,
    artifactSession: ArtifactSession,
  ): Promise<void> {
    await writeFile(
      this.sessionFile(sessionId),
      JSON.stringify(artifactSession),
    );
  }

  private sessionFile(sessionId: string): string {
    return join(this.getRootDir(sessionId), 'session.json');
  }
}
