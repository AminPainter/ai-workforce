export const RAG_DB = 'RAG_DB';

export const RagCollection = {
  LEGAL: 'legal',
} as const;

export type RagCollection = (typeof RagCollection)[keyof typeof RagCollection];
