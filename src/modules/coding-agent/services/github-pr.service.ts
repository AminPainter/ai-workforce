import { Injectable } from '@nestjs/common';

export interface CreatePullRequestInput {
  repo: string;
  token: string;
  head: string;
  base: string;
  title: string;
  body: string;
}

export interface CreatePullRequestResult {
  url: string;
  number: number;
}

@Injectable()
export class GithubPrService {
  async createPullRequest(
    input: CreatePullRequestInput,
  ): Promise<CreatePullRequestResult> {
    const [owner, name] = input.repo.split('/');
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${name}/pulls`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'glomo-ai-workforce-coding-agent',
        },
        body: JSON.stringify({
          title: input.title,
          head: input.head,
          base: input.base,
          body: input.body,
        }),
      },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `GitHub create PR failed: ${response.status} ${detail.slice(0, 300)}`,
      );
    }
    const data = (await response.json()) as {
      html_url: string;
      number: number;
    };
    return { url: data.html_url, number: data.number };
  }
}
