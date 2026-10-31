import {
  FORM9_ISSUE_TYPES,
  FORM9_ISSUE_TYPE_TIPS,
  FORM9_SERVICE_TYPE_BY_ISSUE_TYPE_1,
  type Form9Kind,
} from './form9-mapping.data.js';
import {
  FORM9_COMPLAINT_TYPE_VALUES,
  type Form9ComplaintType,
  type Form9Reportable,
  type Form9ServiceType,
} from './form9-values.js';

export interface Form9Derivation {
  reportable: Form9Reportable;
  serviceType: Form9ServiceType;
  complaintType: Form9ComplaintType;
  othersDetail: string;
  convertedToComplaint: boolean;
}

interface Form9IssueTypeRow {
  issueType1: string;
  issueType2: string;
  issueType3: string;
  kind: Form9Kind;
  complaintType?: Form9ComplaintType;
  othersDetail: string;
  useWhen: string;
}

const NOT_APPLICABLE: Form9ComplaintType = 'NA Not applicable';
const OTHERS: Form9ComplaintType = '13 Others';

function complaintTypeForCode(code: string): Form9ComplaintType | undefined {
  return FORM9_COMPLAINT_TYPE_VALUES.find((value) =>
    value.startsWith(`${code} `),
  );
}

function parseRows(): Form9IssueTypeRow[] {
  const paths = new Set<string>();
  return FORM9_ISSUE_TYPES.map((tuple) => {
    const [l1, l2, l3, kind, code, othersDetail, useWhen] = tuple;
    const path = `${l1} > ${l2} > ${l3}`;
    const complaintType = code ? complaintTypeForCode(code) : undefined;
    if (
      paths.has(path) ||
      !FORM9_SERVICE_TYPE_BY_ISSUE_TYPE_1[l1] ||
      (code && !complaintType) ||
      (kind === 'C' && !complaintType) ||
      (kind === 'X' && complaintType) ||
      (complaintType === OTHERS) !== othersDetail.length > 0
    )
      throw new Error(`form9-mapping: invalid issue type row: ${path}`);
    paths.add(path);
    return {
      issueType1: l1,
      issueType2: l2,
      issueType3: l3,
      kind,
      complaintType,
      othersDetail,
      useWhen,
    };
  });
}

const ROWS = parseRows();

const norm = (value: string | undefined): string =>
  (value ?? '').trim().toLowerCase();

function derive(row: Form9IssueTypeRow, escalated: boolean): Form9Derivation {
  const serviceType = FORM9_SERVICE_TYPE_BY_ISSUE_TYPE_1[row.issueType1];
  const convertedToComplaint =
    row.kind === 'S' && row.complaintType !== undefined && escalated;

  if (row.kind === 'X')
    return {
      reportable: 'Not applicable',
      serviceType,
      complaintType: NOT_APPLICABLE,
      othersDetail: '',
      convertedToComplaint,
    };

  if (row.kind === 'C' || convertedToComplaint) {
    const complaintType = row.complaintType!;
    return {
      reportable: 'Complaint',
      serviceType,
      complaintType,
      othersDetail: complaintType === OTHERS ? row.othersDetail : '',
      convertedToComplaint,
    };
  }

  return {
    reportable: 'Service request',
    serviceType,
    complaintType: NOT_APPLICABLE,
    othersDetail: '',
    convertedToComplaint,
  };
}

export function lookupForm9(
  issueType1: string,
  issueType2: string,
  issueType3: string,
  escalated: boolean,
): Form9Derivation | undefined {
  const row = ROWS.find(
    (candidate) =>
      norm(candidate.issueType1) === norm(issueType1) &&
      norm(candidate.issueType2) === norm(issueType2) &&
      norm(candidate.issueType3) === norm(issueType3),
  );
  return row ? derive(row, escalated) : undefined;
}

export const FORM9_L1_VALUES: string[] = [
  ...new Set(ROWS.map((row) => row.issueType1)),
];

/**
 * A compact `L1 > L2 > L3` tree for the classifier prompt, so the agent can only
 * pick taxonomy nodes that exist in the mapping.
 */
export function renderTaxonomy(): string {
  const byL1 = new Map<string, Map<string, Form9IssueTypeRow[]>>();
  for (const row of ROWS) {
    if (!byL1.has(row.issueType1)) byL1.set(row.issueType1, new Map());
    const byL2 = byL1.get(row.issueType1)!;
    if (!byL2.has(row.issueType2)) byL2.set(row.issueType2, []);
    byL2.get(row.issueType2)!.push(row);
  }

  const blocks: string[] = [];
  for (const [l1, byL2] of byL1) {
    const lines = [l1];
    for (const [l2, rows] of byL2) {
      lines.push(`  - ${l2}`);
      for (const row of rows) {
        const tip = FORM9_ISSUE_TYPE_TIPS[row.issueType3];
        lines.push(
          `      - ${row.issueType3}: ${row.useWhen}${tip ? ` ${tip}` : ''}`,
        );
      }
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}
