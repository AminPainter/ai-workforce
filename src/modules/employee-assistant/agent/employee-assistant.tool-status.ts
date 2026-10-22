import { ATLASSIAN_TOOL_NAMES } from '../../ai/services/atlassian-mcp.service';
import { GITHUB_TOOL_NAMES } from '../../ai/services/github-mcp.service';
import { SENTRY_TOOL_NAMES } from '../../ai/services/sentry-mcp.service';

const TOOL_STATUSES: Record<string, string> = {
  webSearch: 'Searching the web…',
  webFetch: 'Reading a web page…',
  loadSkill: 'Loading a playbook…',
  readSkillReference: 'Loading a playbook…',
  snacksLedger: 'Checking the snacks ledger…',
  markSnacksFulfilled: 'Settling the snacks pledge…',
  delegateCodingTask: 'Handing off to the coding agent…',
};

// GitHub is checked before Sentry because both expose `search_issues` and the
// agent spreads the GitHub tools last, so GitHub's wins.
export function employeeAssistantToolStatus(toolName: string): string {
  if (TOOL_STATUSES[toolName]) return TOOL_STATUSES[toolName];
  if (GITHUB_TOOL_NAMES.has(toolName)) return 'Reading GitHub…';
  if (SENTRY_TOOL_NAMES.has(toolName)) return 'Checking Sentry…';
  if (ATLASSIAN_TOOL_NAMES.has(toolName)) return 'Checking Jira…';
  if (toolName.startsWith('teleport_')) return 'Querying the database…';
  return 'Working on it…';
}
