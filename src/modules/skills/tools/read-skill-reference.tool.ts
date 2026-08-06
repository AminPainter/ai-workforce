import { readFile } from 'fs/promises';
import { tool } from 'ai';
import { z } from 'zod';
import { type LoadedSkill } from '../types/skill.types';
import { resolveReferencePath } from '../utils/skill-reference-path';

export function createReadSkillReferenceTool(
  skillsRegistry: ReadonlyMap<string, LoadedSkill>,
) {
  return tool({
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
      const skill = skillsRegistry.get(name);
      if (!skill)
        return `No skill named "${name}". Available skills: ${[...skillsRegistry.keys()].join(', ')}.`;
      try {
        const resolvedPath = await resolveReferencePath(
          skill.dir,
          relativePath,
        );
        return await readFile(resolvedPath, 'utf8');
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return `readSkillReference failed: ${reason}`;
      }
    },
  });
}
