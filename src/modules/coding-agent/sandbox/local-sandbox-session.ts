import { spawn } from 'child_process';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { Readable } from 'stream';
import {
  type Experimental_SandboxProcess,
  type Experimental_SandboxSession,
} from 'ai';
import {
  type CodingTaskLogger,
  formatDuration,
} from '../logging/coding-task-logger';

type SandboxSession = Experimental_SandboxSession;
type ReadOptions = Parameters<SandboxSession['readBinaryFile']>[0];
type ReadTextOptions = Parameters<SandboxSession['readTextFile']>[0];
type WriteOptions = Parameters<SandboxSession['writeBinaryFile']>[0];
type WriteTextOptions = Parameters<SandboxSession['writeTextFile']>[0];
type WriteStreamOptions = Parameters<SandboxSession['writeFile']>[0];
type ProcessOptions = Parameters<SandboxSession['run']>[0];

const SLOW_COMMAND_MS = 10_000;
const STDERR_TAIL_LENGTH = 500;

const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'Glomo Coding Agent',
  GIT_AUTHOR_EMAIL: 'coding-agent@glomo.one',
  GIT_COMMITTER_NAME: 'Glomo Coding Agent',
  GIT_COMMITTER_EMAIL: 'coding-agent@glomo.one',
};

const GITHUB_CREDENTIAL_HELPER = {
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'credential.https://github.com.helper',
  GIT_CONFIG_VALUE_0:
    '!f() { echo username=x-access-token; echo "password=$GITHUB_PAT"; }; f',
};

export class LocalSandboxSession implements SandboxSession {
  readonly description: string;
  private readonly env: Record<string, string>;
  private readonly runningCommands = new Map<
    number,
    { command: string; startedAt: number }
  >();
  private nextCommandId = 0;

  constructor(
    private readonly rootDir: string,
    githubToken: string,
    private readonly codingTaskLogger: CodingTaskLogger,
  ) {
    this.description = `Host directory ${rootDir}. Commands run directly on the host.`;
    this.env = {
      PATH: process.env.PATH!,
      HOME: rootDir,
      LANG: 'C.UTF-8',
      GIT_TERMINAL_PROMPT: '0',
      GITHUB_PAT: githubToken,
      GH_TOKEN: githubToken,
      ...GIT_IDENTITY,
      ...GITHUB_CREDENTIAL_HELPER,
    };
  }

  async readFile(options: ReadOptions) {
    const bytes = await this.readBinaryFile(options);
    return bytes && new Blob([new Uint8Array(bytes)]).stream();
  }

  async readBinaryFile({ path }: ReadOptions): Promise<Uint8Array | null> {
    return readFile(this.resolvePath(path)).catch(() => null);
  }

  async readTextFile({
    path,
    encoding = 'utf-8',
    startLine = 1,
    endLine,
  }: ReadTextOptions): Promise<string | null> {
    const bytes = await this.readBinaryFile({ path });
    return (
      bytes &&
      new TextDecoder(encoding)
        .decode(bytes)
        .split('\n')
        .slice(startLine - 1, endLine)
        .join('\n')
    );
  }

  async writeFile({ path, content }: WriteStreamOptions): Promise<void> {
    const bytes = new Uint8Array(await new Response(content).arrayBuffer());
    await this.writeBinaryFile({ path, content: bytes });
  }

  async writeBinaryFile({ path, content }: WriteOptions): Promise<void> {
    const target = this.resolvePath(path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }

  async writeTextFile({
    path,
    content,
    encoding = 'utf-8',
  }: WriteTextOptions): Promise<void> {
    await this.writeBinaryFile({
      path,
      content: Buffer.from(content, encoding as BufferEncoding),
    });
  }

  spawn({
    command,
    workingDirectory = '.',
    env,
    abortSignal,
  }: ProcessOptions): Promise<Experimental_SandboxProcess> {
    const commandId = this.nextCommandId++;
    const summary = this.codingTaskLogger.preview(command);
    const startedAt = Date.now();
    this.runningCommands.set(commandId, { command: summary, startedAt });
    this.codingTaskLogger.debug(`$ ${summary} (cwd ${workingDirectory})`);

    const child = spawn('bash', ['-c', command], {
      cwd: this.resolvePath(workingDirectory),
      env: { ...this.env, ...env },
    });
    abortSignal?.addEventListener('abort', () => {
      this.codingTaskLogger.warn(`aborting command: ${summary}`);
      child.kill();
    });
    const exited = new Promise<{ exitCode: number }>((resolveExit) => {
      child.on('error', (error) => {
        this.runningCommands.delete(commandId);
        this.codingTaskLogger.error(
          `command failed to start: ${summary}`,
          error,
        );
        resolveExit({ exitCode: 1 });
      });
      child.on('close', (code, signal) => {
        this.runningCommands.delete(commandId);
        const durationMs = Date.now() - startedAt;
        const message = `command exited ${code ?? signal} after ${formatDuration(durationMs)}: ${summary}`;
        if (code !== 0) this.codingTaskLogger.warn(message);
        else if (durationMs >= SLOW_COMMAND_MS)
          this.codingTaskLogger.log(message);
        else this.codingTaskLogger.debug(message);

        resolveExit({ exitCode: code ?? 1 });
      });
    });

    return Promise.resolve({
      pid: child.pid,
      stdout: Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
      stderr: Readable.toWeb(child.stderr) as ReadableStream<Uint8Array>,
      wait: () => exited,
      kill: () => Promise.resolve(void child.kill()),
    });
  }

  async run(options: ProcessOptions) {
    const child = await this.spawn(options);
    const [stdout, stderr, { exitCode }] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.wait(),
    ]);
    if (exitCode !== 0 && stderr)
      this.codingTaskLogger.warn(
        `stderr: ${this.codingTaskLogger.preview(stderr.slice(-STDERR_TAIL_LENGTH))}`,
      );

    return { exitCode, stdout, stderr };
  }

  describeRunningCommands(): string[] {
    const now = Date.now();
    return [...this.runningCommands.values()].map(
      ({ command, startedAt }) =>
        `${command} (${formatDuration(now - startedAt)})`,
    );
  }

  private resolvePath(path: string): string {
    return resolve(this.rootDir, path);
  }
}
