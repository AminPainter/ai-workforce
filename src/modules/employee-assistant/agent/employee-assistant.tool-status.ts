import { ATLASSIAN_TOOL_NAMES } from '../../ai/services/atlassian-mcp.service';
import { GITHUB_TOOL_NAMES } from '../../ai/services/github-mcp.service';
import { SENTRY_TOOL_NAMES } from '../../ai/services/sentry-mcp.service';
import { WebTool } from '../../ai/constants/web-tools';
import { SkillTool } from '../../skills/constants/skill-tools';
import { SnackTool } from '../../snack-tracker/constants/snack-tools';
import { CodingAgentTool } from '../../coding-agent/constants/coding-agent-tools';

type LocalTool = WebTool | SkillTool | SnackTool | CodingAgentTool;

const TOOL_STATUSES: Record<LocalTool, string> = {
  [WebTool.WEB_SEARCH]: 'Searching the web…',
  [WebTool.WEB_FETCH]: 'Reading a web page…',
  [SkillTool.LOAD_SKILL]: 'Loading a playbook…',
  [SkillTool.READ_SKILL_REFERENCE]: 'Loading a playbook…',
  [SnackTool.SNACKS_LEDGER]: 'Checking the snacks ledger…',
  [SnackTool.MARK_SNACKS_FULFILLED]: 'Settling the snacks pledge…',
  [CodingAgentTool.DELEGATE_CODING_TASK]: 'Handing off to the coding agent…',
};

function isLocalTool(toolName: string): toolName is LocalTool {
  return Object.hasOwn(TOOL_STATUSES, toolName);
}

export function employeeAssistantToolStatus(toolName: string): string {
  if (isLocalTool(toolName)) return TOOL_STATUSES[toolName];
  if (GITHUB_TOOL_NAMES.has(toolName)) return 'Reading GitHub…';
  if (SENTRY_TOOL_NAMES.has(toolName)) return 'Checking Sentry…';
  if (ATLASSIAN_TOOL_NAMES.has(toolName)) return 'Checking Jira…';
  if (toolName.startsWith('teleport_')) return 'Querying the database…';
  return 'Working on it…';
}
