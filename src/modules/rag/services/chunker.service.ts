import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PdfPage } from './pdf-parser.service';

const DEFAULT_CHUNK_CHARS = 1800;
const DEFAULT_CHUNK_OVERLAP = 300;
const SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

export interface Chunk {
  content: string;
  page: number;
  chunkIndex: number;
}

@Injectable()
export class ChunkerService {
  private readonly chunkChars: number;
  private readonly overlap: number;

  constructor(private readonly configService: ConfigService) {
    this.chunkChars = Number(
      this.configService.get('RAG_CHUNK_CHARS') ?? DEFAULT_CHUNK_CHARS,
    );
    this.overlap = Number(
      this.configService.get('RAG_CHUNK_OVERLAP') ?? DEFAULT_CHUNK_OVERLAP,
    );
  }

  chunk(pages: PdfPage[]): Chunk[] {
    const chunks: Chunk[] = [];
    let chunkIndex = 0;
    for (const { page, text } of pages)
      for (const content of this.splitText(text))
        chunks.push({ content, page, chunkIndex: chunkIndex++ });

    return chunks;
  }

  private splitText(text: string): string[] {
    const normalized = text.replace(/[ \t]+\n/g, '\n').trim();
    if (!normalized) return [];
    const pieces = this.recursiveSplit(normalized, SEPARATORS);
    return this.mergeWithOverlap(pieces);
  }

  private recursiveSplit(text: string, separators: string[]): string[] {
    if (text.length <= this.chunkChars) return text ? [text] : [];

    const [separator, ...rest] = separators;
    if (separator === undefined) return this.hardSplit(text);

    const parts = separator === '' ? text.split('') : text.split(separator);
    const result: string[] = [];
    for (const part of parts) {
      const piece = separator === '' ? part : part + separator;
      if (piece.length <= this.chunkChars) {
        if (piece.trim()) result.push(piece);
      } else result.push(...this.recursiveSplit(piece, rest));
    }
    return result;
  }

  private hardSplit(text: string): string[] {
    const result: string[] = [];
    for (let i = 0; i < text.length; i += this.chunkChars)
      result.push(text.slice(i, i + this.chunkChars));

    return result;
  }

  private mergeWithOverlap(pieces: string[]): string[] {
    const chunks: string[] = [];
    let current = '';
    for (const piece of pieces)
      if (current && current.length + piece.length > this.chunkChars) {
        chunks.push(current.trim());
        current =
          this.overlap > 0 ? current.slice(-this.overlap) + piece : piece;
      } else current += piece;

    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }
}
