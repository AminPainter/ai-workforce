export const ARTIFACT_BUILD_QUEUE = 'artifact-build';
export const ARTIFACT_PUBLISH_QUEUE = 'artifact-publish';

export interface ArtifactBuildJob {
  threadId: string;
  requesterUserId: string;
  title: string;
  brief: string;
  baseHtml?: string;
}

export interface ArtifactPublishJob {
  threadId: string;
  requesterUserId: string;
  title: string;
  html: string;
  model: string;
  published?: { artifactId: string; version: number };
}
