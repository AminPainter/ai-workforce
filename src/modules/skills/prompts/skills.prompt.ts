import { type LoadedSkill } from '../types/skill.types';

export function buildSkillsPromptSection(skills: LoadedSkill[]): string {
  if (!skills.length) return '';

  const list = skills
    .map((skill) => `- **${skill.name}**: ${skill.description}`)
    .join('\n');

  return `Skills:\nYou have access to the following skills -- specialised, repeatable workflows. When a request matches one, call the \`loadSkill\` tool with its name to load the full instructions before acting.\n${list}`;
}
