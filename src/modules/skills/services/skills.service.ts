import { Injectable, Logger } from '@nestjs/common';
import { type ToolSet } from 'ai';
import { type AgentSkillBundle, type LoadedSkill } from '../types/skill.types';
import { buildSkillsPromptSection } from '../prompts/skills.prompt';
import { createLoadSkillTool } from '../tools/load-skill.tool';
import { createReadSkillReferenceTool } from '../tools/read-skill-reference.tool';
import { SkillLoaderService } from './skill-loader.service';

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

  constructor(private readonly skillLoaderService: SkillLoaderService) {}

  buildAgentSkills(dirs: string[]): AgentSkillBundle {
    const skills = dirs.map((dir) => this.skillLoaderService.load(dir));
    const registry = new Map(skills.map((skill) => [skill.name, skill]));

    const names = skills.map((skill) => skill.name);
    this.logger.log(`Loaded ${names.length} skills: ${names.join(', ')}`);

    return {
      promptSection: buildSkillsPromptSection(skills),
      tools: this.buildTools(registry),
    };
  }

  private buildTools(
    skillsRegistry: ReadonlyMap<string, LoadedSkill>,
  ): ToolSet {
    return {
      loadSkill: createLoadSkillTool(skillsRegistry),
      readSkillReference: createReadSkillReferenceTool(skillsRegistry),
    };
  }
}
