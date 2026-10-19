export const CODING_AGENT_QUEUE = 'coding-agent';
export const CODING_AGENT_REPLIES_QUEUE = 'coding-agent-replies';

export interface CodingTaskJob {
  threadId: string;
  repo: string;
  task: string;
}

export interface CodingReplyJob {
  threadId: string;
  text: string;
}
