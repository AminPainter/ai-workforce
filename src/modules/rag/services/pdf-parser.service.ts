import { Injectable } from '@nestjs/common';
import { extractText, getDocumentProxy } from 'unpdf';

export interface PdfPage {
  page: number;
  text: string;
}

@Injectable()
export class PdfParserService {
  async parse(data: Uint8Array): Promise<PdfPage[]> {
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: false });
    return text.map((pageText, index) => ({
      page: index + 1,
      text: pageText,
    }));
  }
}
