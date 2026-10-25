import { Injectable } from '@nestjs/common';

export enum ArtifactScanFindingType {
  CARD_NUMBER = 'card number',
  AADHAAR_NUMBER = 'Aadhaar number',
  PAN = 'PAN',
  BANK_ACCOUNT_NUMBER = 'bank account number near an IFSC',
  API_TOKEN = 'API key or token',
  JWT = 'JWT',
  PRIVATE_KEY = 'private key',
  CREDENTIAL_URI = 'connection URI with credentials',
  EMAIL = 'email address',
  PHONE_NUMBER = 'phone number',
}

export interface ArtifactScanFinding {
  type: ArtifactScanFindingType;
  line: number;
}

export interface ArtifactScanResult {
  blocked: ArtifactScanFinding[];
  warnings: ArtifactScanFinding[];
}

interface ScanRule {
  type: ArtifactScanFindingType;
  pattern: RegExp;
  accept?: (match: string, index: number, text: string) => boolean;
}

const IFSC_ACCOUNT_WINDOW = 100;

const ACCOUNT_NUMBER_PATTERN = /(?<![\w.])\d{9,18}(?!\w|\.\d)/;

const BLOCK_RULES: ScanRule[] = [
  {
    type: ArtifactScanFindingType.CARD_NUMBER,
    pattern:
      /(?<![\w.])(?:[2-68]\d{12,18}|[2-68]\d{3}([ -])\d{4}\1\d{4}\1\d{1,7}|[2-68]\d{3}([ -])\d{6}\2\d{4,5})(?!\w|\.\d)/g,
    accept: (match) => passesLuhn(digitsOf(match)),
  },
  {
    type: ArtifactScanFindingType.AADHAAR_NUMBER,
    pattern: /(?<![\w.])[2-9]\d{3}([ -]?)\d{4}\1\d{4}(?!\w|\.\d)/g,
    accept: (match) => passesVerhoeff(digitsOf(match)),
  },
  {
    type: ArtifactScanFindingType.PAN,
    pattern:
      /(?<![A-Za-z0-9])[A-Z]{3}[ABCFGHJLPT][A-Z]\d{4}[A-Z](?![A-Za-z0-9])/g,
  },
  {
    type: ArtifactScanFindingType.BANK_ACCOUNT_NUMBER,
    pattern: /(?<![A-Za-z0-9])[A-Z]{4}0[A-Z0-9]{6}(?![A-Za-z0-9])/g,
    accept: (match, index, text) =>
      ACCOUNT_NUMBER_PATTERN.test(
        text.slice(
          Math.max(0, index - IFSC_ACCOUNT_WINDOW),
          index + match.length + IFSC_ACCOUNT_WINDOW,
        ),
      ),
  },
  {
    type: ArtifactScanFindingType.API_TOKEN,
    pattern:
      /(?<![A-Za-z0-9])(?:sk-[A-Za-z0-9_-]{20,}|gh[ps]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abp]-[A-Za-z0-9-]{10,})/g,
  },
  {
    type: ArtifactScanFindingType.JWT,
    pattern: /eyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\./g,
  },
  {
    type: ArtifactScanFindingType.PRIVATE_KEY,
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g,
  },
  {
    type: ArtifactScanFindingType.CREDENTIAL_URI,
    pattern: /\b(?:postgres(?:ql)?|rediss?):\/\/[^\s:@/]*:[^\s@/]+@/gi,
  },
];

const WARN_RULES: ScanRule[] = [
  {
    type: ArtifactScanFindingType.EMAIL,
    pattern:
      /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
  },
  {
    type: ArtifactScanFindingType.PHONE_NUMBER,
    pattern: /(?<![\w.+])(?:\+91[ -]?)?[6-9]\d{4}[ -]?\d{5}(?!\w|\.\d)/g,
  },
];

const VERHOEFF_MULTIPLICATION = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_PERMUTATION = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 7, 6, 8, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function digitsOf(value: string): number[] {
  return value.replace(/\D/g, '').split('').map(Number);
}

function passesLuhn(digits: number[]): boolean {
  const sum = digits.reduceRight((total, digit, index) => {
    if ((digits.length - 1 - index) % 2 === 0) return total + digit;
    const doubled = digit * 2;
    return total + (doubled > 9 ? doubled - 9 : doubled);
  }, 0);
  return sum % 10 === 0;
}

function passesVerhoeff(digits: number[]): boolean {
  const checksum = [...digits]
    .reverse()
    .reduce(
      (check, digit, index) =>
        VERHOEFF_MULTIPLICATION[check][VERHOEFF_PERMUTATION[index % 8][digit]],
      0,
    );
  return checksum === 0;
}

@Injectable()
export class ArtifactScannerService {
  scan(text: string): ArtifactScanResult {
    const lineStarts = this.lineStarts(text);
    return {
      blocked: this.apply(BLOCK_RULES, text, lineStarts),
      warnings: this.apply(WARN_RULES, text, lineStarts),
    };
  }

  private apply(
    rules: ScanRule[],
    text: string,
    lineStarts: number[],
  ): ArtifactScanFinding[] {
    return rules.flatMap(({ type, pattern, accept }) =>
      [...text.matchAll(pattern)]
        .filter(({ 0: match, index }) => !accept || accept(match, index, text))
        .map(({ index }) => ({ type, line: this.lineOf(index, lineStarts) })),
    );
  }

  private lineStarts(text: string): number[] {
    const starts = [0];
    let index = text.indexOf('\n');
    while (index !== -1) {
      starts.push(index + 1);
      index = text.indexOf('\n', index + 1);
    }
    return starts;
  }

  private lineOf(index: number, lineStarts: number[]): number {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (lineStarts[mid] <= index) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  }
}
