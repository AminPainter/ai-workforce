import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface DraftPullRequest {
  repo: string;
  head: string;
  base: string;
  title: string;
  body: string;
}

@Injectable()
export class GitHubPullRequestService {
  private readonly githubToken: string;

  constructor(configService: ConfigService) {
    this.githubToken = configService.getOrThrow<string>('GITHUB_PAT');
  }

  async createDraft({
    repo,
    ...pullRequest
  }: DraftPullRequest): Promise<string> {
    const { data } = await axios.post<{ html_url: string }>(
      `https://api.github.com/repos/${repo}/pulls`,
      { ...pullRequest, draft: true },
      { headers: { Authorization: `Bearer ${this.githubToken}` } },
    );
    return data.html_url;
  }
}
