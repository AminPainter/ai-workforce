import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitService } from './git.service';
import { GithubPrService } from './github-pr.service';
import { type PiConfigPaths, writePiConfig } from '../pi/models-config';

const DEFAULT_REPO = 'AminPainter/ai-workforce';
const DEFAULT_BASE_BRANCH = 'main';
const DEFAULT_GIT_NAME = 'glomo-coding-agent';
const DEFAULT_GIT_EMAIL = 'coding-agent@glomopay.com';

export interface RunTaskInput {
  instruction: string;
  title: string;
  body?: string;
  baseBranch?: string;
}

export interface RunTaskResult {
  prUrl: string;
  prNumber: number;
  branch: string;
}

@Injectable()
export class CodingAgentService {
  private readonly logger = new Logger(CodingAgentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly gitService: GitService,
    private readonly githubPrService: GithubPrService,
  ) {}

  async runTask(input: RunTaskInput): Promise<RunTaskResult> {
    const token = this.configService.getOrThrow<string>(
      'GITHUB_CODING_AGENT_TOKEN',
    );
    const repo =
      this.configService.get<string>('CODING_AGENT_REPO') ?? DEFAULT_REPO;
    const baseBranch =
      input.baseBranch ??
      this.configService.get<string>('CODING_AGENT_BASE_BRANCH') ??
      DEFAULT_BASE_BRANCH;
    const gatewayBaseUrl = this.configService.getOrThrow<string>(
      'AI_GATEWAY_BASE_URL',
    );
    const modelSlug = this.configService.getOrThrow<string>('AI_GATEWAY_MODEL');
    const gitName =
      this.configService.get<string>('CODING_AGENT_GIT_NAME') ??
      DEFAULT_GIT_NAME;
    const gitEmail =
      this.configService.get<string>('CODING_AGENT_GIT_EMAIL') ??
      DEFAULT_GIT_EMAIL;

    const workdir = await mkdtemp(join(tmpdir(), 'coding-agent-work-'));
    const configDir = await mkdtemp(join(tmpdir(), 'coding-agent-pi-'));
    const branch = `coding-agent/${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const repoUrl = `https://github.com/${repo}.git`;

    try {
      this.logger.log(`Cloning ${repo}@${baseBranch} into ${workdir}`);
      await this.gitService.clone(repoUrl, workdir, baseBranch, { token });
      const baseSha = (
        await this.gitService.run(['rev-parse', 'HEAD'], { cwd: workdir })
      ).trim();
      await this.gitService.run(['checkout', '-b', branch], { cwd: workdir });

      const piPaths = await writePiConfig({
        configDir,
        gatewayBaseUrl,
        modelSlug,
      });

      this.logger.log(
        `Running Pi coding agent (${piPaths.providerId}/${piPaths.modelId})`,
      );
      const agentError = await this.runPiAgent(
        workdir,
        piPaths,
        input.instruction,
      );

      await this.gitService.run(['add', '-A'], { cwd: workdir });
      const status = await this.gitService.run(['status', '--porcelain'], {
        cwd: workdir,
      });
      if (status.trim().length > 0)
        await this.gitService.run(
          [
            '-c',
            `user.name=${gitName}`,
            '-c',
            `user.email=${gitEmail}`,
            'commit',
            '-m',
            input.title,
          ],
          { cwd: workdir },
        );

      const ahead = (
        await this.gitService.run(['rev-list', '--count', `${baseSha}..HEAD`], {
          cwd: workdir,
        })
      ).trim();
      if (ahead === '0')
        throw new Error(
          `Coding agent produced no changes; nothing to open a PR for.${
            agentError ? ` Agent error: ${agentError}` : ''
          }`,
        );

      this.logger.log(`Pushing ${branch}`);
      await this.gitService.run(['push', 'origin', branch], {
        cwd: workdir,
        auth: { token },
      });

      const pr = await this.githubPrService.createPullRequest({
        repo,
        token,
        head: branch,
        base: baseBranch,
        title: input.title,
        body: input.body ?? this.defaultBody(input.instruction),
      });
      this.logger.log(`Opened PR ${pr.url}`);

      return { prUrl: pr.url, prNumber: pr.number, branch };
    } finally {
      await rm(workdir, { recursive: true, force: true }).catch(() => {});
      await rm(configDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async runPiAgent(
    cwd: string,
    piPaths: PiConfigPaths,
    instruction: string,
  ): Promise<string | undefined> {
    const { createAgentSession, ModelRuntime, SessionManager } =
      await import('@earendil-works/pi-coding-agent');

    const modelRuntime = await ModelRuntime.create({
      modelsPath: piPaths.modelsPath,
      authPath: piPaths.authPath,
      modelsStorePath: piPaths.modelsStorePath,
      allowModelNetwork: false,
    });

    const model = modelRuntime.getModel(piPaths.providerId, piPaths.modelId);
    if (!model)
      throw new Error(
        `Pi model ${piPaths.providerId}/${piPaths.modelId} not found in models.json`,
      );

    const { session } = await createAgentSession({
      cwd,
      agentDir: piPaths.agentDir,
      modelRuntime,
      model,
      tools: ['read', 'write', 'edit', 'bash'],
      sessionManager: SessionManager.inMemory(cwd),
    });

    try {
      await session.prompt(instruction);
      await session.agent.waitForIdle();
      return session.agent.state.errorMessage;
    } finally {
      session.dispose();
    }
  }

  private defaultBody(instruction: string): string {
    return [
      'Opened autonomously by the Glomopay coding agent (Pi SDK).',
      '',
      '**Instruction**',
      '',
      instruction,
      '',
      '_Review before merge — no human authored this change._',
    ].join('\n');
  }
}
