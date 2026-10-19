export const CODING_AGENT_QUEUE = 'coding-agent';
export const CODING_TASK_SLACK_SUMMARY_QUEUE = 'coding-task-slack-summaries';

export interface CodingTaskJob {
  threadId: string;
  repo: string;
  task: string;
}

export interface CodingTaskSlackSummaryJob {
  threadId: string;
  text: string;
}
