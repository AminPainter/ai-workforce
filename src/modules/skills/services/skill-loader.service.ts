import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { basename, resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import { skillFrontmatterSchema } from '../schema/skill.schema';
import { type LoadedSkill } from '../types/skill.types';

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

@Injectable()
export class SkillLoaderService {
  load(dir: string): LoadedSkill {
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
}
