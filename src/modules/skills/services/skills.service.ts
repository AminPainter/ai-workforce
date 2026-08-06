import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { readFile, realpath } from 'fs/promises';
import { basename, resolve, sep } from 'path';
import { parse as parseYaml } from 'yaml';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { skillFrontmatterSchema } from '../skill.schema';
import { type AgentSkillBundle, type LoadedSkill } from '../skill.types';

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

  loadSkill(dir: string): LoadedSkill {
    const skillMdPath = resolve(dir, 'SKILL.md');
    const content = readFileSync(skillMdPath, 'utf8');

    const match = FRONTMATTER_PATTERN.exec(content);
    if (!match)
      throw new Error(
        `${skillMdPath} is missing YAML frontmatter delimited by "---".`,
      );
    const [, frontmatterYaml, body] = match;
    const frontmatter = skillFrontmatterSchema.parse(
      parseYaml(frontmatterYaml),
    );

    const dirName = basename(dir);
    if (frontmatter.name !== dirName)
      throw new Error(
        `Skill name "${frontmatter.name}" must match its directory name "${dirName}" (${dir}).`,
      );

    return {
      name: frontmatter.name,
      description: frontmatter.description,
      dir,
      body: body.trim(),
    };
  }

  buildAgentSkills(dirs: string[]): AgentSkillBundle {
    const skills = dirs.map((dir) => this.loadSkill(dir));
    const registry = new Map(skills.map((skill) => [skill.name, skill]));

    const names = skills.map((skill) => skill.name);
    this.logger.log(`Loaded ${names.length} skills: ${names.join(', ')}`);

    return {
      promptSection: this.buildPromptSection(skills),
      tools: this.buildTools(registry),
    };
  }

  private buildPromptSection(skills: LoadedSkill[]): string {
    if (!skills.length) return '';

    const list = skills
      .map((skill) => `- **${skill.name}**: ${skill.description}`)
      .join('\n');

    return `Skills:\nYou have access to the following skills -- specialised, repeatable workflows. When a request matches one, call the \`loadSkill\` tool with its name to load the full instructions before acting.\n${list}`;
  }

  private buildTools(registry: Map<string, LoadedSkill>): ToolSet {
    return {
      loadSkill: tool({
        description:
          "Load the full instructions for a skill, by name. Call this before following a skill's workflow.",
        inputSchema: z.object({
          name: z
            .string()
            .describe('The skill name, as listed in your instructions.'),
        }),
        execute: ({ name }) => {
          const skill = registry.get(name);
          if (!skill)
            return `No skill named "${name}". Available skills: ${[...registry.keys()].join(', ')}.`;
          return skill.body;
        },
      }),
      readSkillReference: tool({
        description:
          "Read a reference file from an activated skill's references/ directory, by relative path.",
        inputSchema: z.object({
          name: z.string().describe('The skill name.'),
          path: z
            .string()
            .describe(
              'Path relative to the skill\'s references/ directory, e.g. "frame-mapping.md".',
            ),
        }),
        execute: async ({ name, path: relativePath }) => {
          const skill = registry.get(name);
          if (!skill)
            return `No skill named "${name}". Available skills: ${[...registry.keys()].join(', ')}.`;
          try {
            const resolvedPath = await this.resolveReferencePath(
              skill.dir,
              relativePath,
            );
            return await readFile(resolvedPath, 'utf8');
          } catch (error) {
            const reason =
              error instanceof Error ? error.message : String(error);
            return `readSkillReference failed: ${reason}`;
          }
        },
      }),
    };
  }

  private async resolveReferencePath(
    skillDir: string,
    relativePath: string,
  ): Promise<string> {
    const referencesDir = resolve(skillDir, 'references');
    const candidate = resolve(referencesDir, relativePath);
    if (
      candidate !== referencesDir &&
      !candidate.startsWith(referencesDir + sep)
    )
      throw new Error(
        `Path "${relativePath}" escapes the skill's references directory.`,
      );

    const [realReferencesDir, realCandidate] = await Promise.all([
      realpath(referencesDir),
      realpath(candidate),
    ]);
    if (
      realCandidate !== realReferencesDir &&
      !realCandidate.startsWith(realReferencesDir + sep)
    )
      throw new Error(
        `Path "${relativePath}" resolves outside the skill's references directory.`,
      );

    return realCandidate;
  }
}
