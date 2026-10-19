import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GITHUB_API_URL = 'https://api.github.com';
const PAGE_SIZE = 100;

export interface PullRequestFile {
  filename: string;
  previous_filename?: string;
  status: string;
  patch?: string;
}

export interface PullRequestCommit {
  author: { login: string } | null;
  commit: { author: { email: string } | null };
}

@Injectable()
export class GitHubApiService {
  private readonly token: string;

  constructor(configService: ConfigService) {
    this.token = configService.getOrThrow<string>('GITHUB_PAT');
  }

  listPullRequestFiles(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestFile[]> {
    return this.paginate(`/repos/${repo}/pulls/${prNumber}/files`);
  }

  listPullRequestCommits(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestCommit[]> {
    return this.paginate(`/repos/${repo}/pulls/${prNumber}/commits`);
  }

  private async paginate<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const batch = await this.get<T[]>(
        `${path}?per_page=${PAGE_SIZE}&page=${page}`,
      );
      items.push(...batch);
      if (batch.length < PAGE_SIZE) return items;
    }
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${GITHUB_API_URL}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok)
      throw new Error(`GitHub GET ${path} failed: ${response.status}`);
    return (await response.json()) as T;
  }
}
