import { tool } from 'ai';
import { z } from 'zod';
import { type LoadedSkill } from '../skill.types';

export function createLoadSkillTool(
  registry: ReadonlyMap<string, LoadedSkill>,
) {
  return tool({
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
  });
}
