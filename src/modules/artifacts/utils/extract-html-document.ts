const HTML_DOCUMENT_PATTERN =
  /(?:<!doctype html[^>]*>|<html[\s>])[\s\S]*<\/html>/i;

export function extractHtmlDocument(text: string): string | undefined {
  return HTML_DOCUMENT_PATTERN.exec(text)?.[0];
}
