import { FORM9_MAPPING_CSV } from './form9-mapping.data';
import {
  FORM9_COMPLAINT_TYPE_VALUES,
  FORM9_REPORTABLE_VALUES,
  FORM9_SERVICE_TYPE_VALUES,
  type Form9ComplaintType,
  type Form9Reportable,
  type Form9ServiceType,
} from './form9-values';

export interface Form9Derivation {
  reportable: Form9Reportable;
  serviceType: Form9ServiceType;
  complaintType: Form9ComplaintType;
  // The taxonomy node the mapping actually matched (after L3->L2->L1 fallback).
  // Used to build a canonical "L2 > L3" others_detail label rather than echoing
  // the agent's raw, possibly-unmatched strings.
  matchedIssueType1: string;
  matchedIssueType2: string;
  matchedIssueType3: string;
}

interface Form9MappingRow {
  issueType1: string;
  issueType2: string;
  issueType3: string;
  reportable: Form9Reportable;
  serviceType: Form9ServiceType;
  complaintType: Form9ComplaintType;
}

function parseRows(): Form9MappingRow[] {
  const reportable = new Set<string>(FORM9_REPORTABLE_VALUES);
  const serviceType = new Set<string>(FORM9_SERVICE_TYPE_VALUES);
  const complaintType = new Set<string>(FORM9_COMPLAINT_TYPE_VALUES);

  const lines = FORM9_MAPPING_CSV.split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  lines.shift(); // header

  const rows: Form9MappingRow[] = [];
  for (const line of lines) {
    const cols = line.split(',');
    const [l1, l2, l3, rep, svc, cmp] = cols;
    if (
      !reportable.has(rep) ||
      !serviceType.has(svc) ||
      !complaintType.has(cmp)
    )
      throw new Error(`form9-mapping: unknown Form 9 value in row: ${line}`);
    rows.push({
      issueType1: l1,
      issueType2: l2,
      issueType3: l3,
      reportable: rep as Form9Reportable,
      serviceType: svc as Form9ServiceType,
      complaintType: cmp as Form9ComplaintType,
    });
  }
  return rows;
}

const ROWS = parseRows();

const norm = (value: string | undefined): string => (value ?? '').trim();

/**
 * Resolve a taxonomy node to its Form 9 treatment, most specific first:
 * exact L1/L2/L3, then the L2 default (L3 blank), then the L1 default (L2/L3
 * blank). Choosing the L3 is choosing the Form 9 treatment, so an unmatched or
 * blank L3 must still land on a defined rule rather than nothing.
 */
export function lookupForm9(
  issueType1: string,
  issueType2?: string,
  issueType3?: string,
): Form9Derivation | undefined {
  const l1 = norm(issueType1);
  const l2 = norm(issueType2);
  const l3 = norm(issueType3);

  const candidates: Array<[string, string, string]> = [
    [l1, l2, l3],
    [l1, l2, ''],
    [l1, '', ''],
  ];
  for (const [c1, c2, c3] of candidates) {
    const match = ROWS.find(
      (row) =>
        row.issueType1 === c1 && row.issueType2 === c2 && row.issueType3 === c3,
    );
    if (match)
      return {
        reportable: match.reportable,
        serviceType: match.serviceType,
        complaintType: match.complaintType,
        matchedIssueType1: match.issueType1,
        matchedIssueType2: match.issueType2,
        matchedIssueType3: match.issueType3,
      };
  }
  return undefined;
}

export const FORM9_L1_VALUES: string[] = [
  ...new Set(ROWS.map((row) => row.issueType1)),
];

/**
 * A compact `L1 > L2 > L3` tree for the classifier prompt, so the agent can only
 * pick taxonomy nodes that exist in the mapping.
 */
export function renderTaxonomy(): string {
  const byL1 = new Map<string, Map<string, Set<string>>>();
  for (const row of ROWS) {
    if (!byL1.has(row.issueType1)) byL1.set(row.issueType1, new Map());
    const byL2 = byL1.get(row.issueType1)!;
    if (row.issueType2 && !byL2.has(row.issueType2))
      byL2.set(row.issueType2, new Set());
    if (row.issueType2 && row.issueType3)
      byL2.get(row.issueType2)!.add(row.issueType3);
  }

  const blocks: string[] = [];
  for (const [l1, byL2] of byL1) {
    const lines = [l1];
    for (const [l2, l3s] of byL2) {
      lines.push(`  - ${l2}`);
      for (const l3 of l3s) lines.push(`      - ${l3}`);
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}
