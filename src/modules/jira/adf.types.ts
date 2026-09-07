export interface AdfNode {
  type: string;
  content?: AdfNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

export interface AdfDoc {
  type: 'doc';
  version: 1;
  content: AdfNode[];
}
