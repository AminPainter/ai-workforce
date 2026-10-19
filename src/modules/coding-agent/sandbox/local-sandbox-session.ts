import { spawn } from 'child_process';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { Readable } from 'stream';
import {
  type Experimental_SandboxProcess,
  type Experimental_SandboxSession,
} from 'ai';

type SandboxSession = Experimental_SandboxSession;
type ReadOptions = Parameters<SandboxSession['readBinaryFile']>[0];
type ReadTextOptions = Parameters<SandboxSession['readTextFile']>[0];
type WriteOptions = Parameters<SandboxSession['writeBinaryFile']>[0];
type WriteTextOptions = Parameters<SandboxSession['writeTextFile']>[0];
type WriteStreamOptions = Parameters<SandboxSession['writeFile']>[0];
type ProcessOptions = Parameters<SandboxSession['run']>[0];

const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'Glomo Coding Agent',
  GIT_AUTHOR_EMAIL: 'coding-agent@glomo.one',
  GIT_COMMITTER_NAME: 'Glomo Coding Agent',
  GIT_COMMITTER_EMAIL: 'coding-agent@glomo.one',
};

export class LocalSandboxSession implements SandboxSession {
  readonly description: string;
  private readonly env: Record<string, string>;

  constructor(private readonly rootDir: string) {
    this.description = `Host directory ${rootDir}. Commands run directly on the host.`;
    this.env = {
      PATH: process.env.PATH!,
      HOME: rootDir,
      LANG: 'C.UTF-8',
      GIT_TERMINAL_PROMPT: '0',
      ...GIT_IDENTITY,
    };
  }

  async readFile(options: ReadOptions) {
    const bytes = await this.readBinaryFile(options);
    return bytes && new Blob([new Uint8Array(bytes)]).stream();
  }

  async readBinaryFile({ path }: ReadOptions): Promise<Uint8Array | null> {
    return readFile(this.resolve(path)).catch(() => null);
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
    const target = this.resolve(path);
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
    const child = spawn('bash', ['-c', command], {
      cwd: this.resolve(workingDirectory),
      env: { ...this.env, ...env },
    });
    abortSignal?.addEventListener('abort', () => child.kill());
    const exited = new Promise<{ exitCode: number }>((resolveExit) =>
      child.on('close', (code) => resolveExit({ exitCode: code ?? 1 })),
    );

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
    return { exitCode, stdout, stderr };
  }

  private resolve(path: string): string {
    return resolve(this.rootDir, path);
  }
}
