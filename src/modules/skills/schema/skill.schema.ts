import { z } from 'zod';

export const skillFrontmatterSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase kebab-case'),
  description: z.string().min(1).max(1024),
});

export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;
