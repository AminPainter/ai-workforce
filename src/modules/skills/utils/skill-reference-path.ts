import { realpath } from 'fs/promises';
import { resolve, sep } from 'path';

export async function resolveReferencePath(
  skillDir: string,
  relativePath: string,
): Promise<string> {
  const referencesDir = resolve(skillDir, 'references');
  const candidate = resolve(referencesDir, relativePath);
  if (candidate !== referencesDir && !candidate.startsWith(referencesDir + sep))
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
