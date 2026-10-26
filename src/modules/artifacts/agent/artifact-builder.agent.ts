import { ConfigService } from '@nestjs/config';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createPi } from '@ai-sdk/harness-pi';
import {
  PI_MODEL,
  glomoPiProviders,
} from '../../coding-agent/agent/coding.settings.js';
import { createArtifactFileTools } from '../tools/artifact-file.tools.js';
import { ARTIFACT_BUILDER_SYSTEM_PROMPT } from './artifact-builder.prompt.js';

export const ARTIFACT_BUILDER_AGENT = 'artifact-builder-agent';

export const SITE_DIR = 'site';

export function createArtifactBuilderAgentFactory(
  configService: ConfigService,
) {
  return (siteDir: string) =>
    new HarnessAgent({
      harness: createPi({
        providers: glomoPiProviders(configService),
        thinkingLevel: 'high',
        cacheRetention: 'long',
      }),
      model: PI_MODEL,
      instructions: ARTIFACT_BUILDER_SYSTEM_PROMPT,
      sandboxConfig: { workDir: SITE_DIR },
      tools: createArtifactFileTools(siteDir),
      inactiveTools: ['write', 'edit'],
    });
}

export type ArtifactBuilderAgentFactory = ReturnType<
  typeof createArtifactBuilderAgentFactory
>;
