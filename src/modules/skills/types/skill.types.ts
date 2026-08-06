import { type ToolSet } from 'ai';

export interface LoadedSkill {
  name: string;
  description: string;
  dir: string;
  body: string;
}

export interface AgentSkillBundle {
  promptSection: string;
  tools: ToolSet;
}
