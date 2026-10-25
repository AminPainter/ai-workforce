export const ARTIFACT_GENERATION_QUEUE = 'artifact-generation';

export interface ArtifactGenerationJob {
  threadId: string;
  requesterUserId: string;
  title: string;
  brief: string;
  artifactId?: string;
}
