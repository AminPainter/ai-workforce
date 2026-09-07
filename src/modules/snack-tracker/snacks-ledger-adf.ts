import type { AdfDoc, AdfNode } from '../jira/adf.types';

export interface SnacksPledgeRecord {
  messageId: string;
  userId: string;
  userName: string;
  fullName: string;
  text: string;
  pledgedAt: string;
}

export interface OpenDebtor {
  userId: string;
  userName: string;
  fullName: string;
  openCount: number;
  lastPledgedAt: string;
}

const LEDGER_HEADING = 'Ledger data (auto-managed — do not edit below)';

export function netDebtors(records: SnacksPledgeRecord[]): OpenDebtor[] {
  const byUser = new Map<string, OpenDebtor>();
  for (const record of records) {
    const current = byUser.get(record.userId);
    if (current) {
      current.openCount += 1;
      if (record.pledgedAt > current.lastPledgedAt)
        current.lastPledgedAt = record.pledgedAt;
    } else
      byUser.set(record.userId, {
        userId: record.userId,
        userName: record.userName,
        fullName: record.fullName,
        openCount: 1,
        lastPledgedAt: record.pledgedAt,
      });
  }
  return [...byUser.values()].sort((a, b) => b.openCount - a.openCount);
}

export function parseLedgerRecords(
  description: AdfDoc | null,
): SnacksPledgeRecord[] {
  const codeBlock = description?.content.find(
    (node) => node.type === 'codeBlock',
  );
  const raw = codeBlock?.content?.map((child) => child.text ?? '').join('');
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SnacksPledgeRecord[]) : [];
  } catch {
    return [];
  }
}

export function buildLedgerDescription(records: SnacksPledgeRecord[]): AdfDoc {
  const debtors = netDebtors(records);

  const content: AdfNode[] = [
    heading(2, '🍫 Bakar Snacks Tracker'),
    paragraph(
      debtors.length === 0
        ? 'No snacks pending right now. Suspiciously wholesome. 🍩'
        : 'Snacks currently pending — updated automatically by glomopay-bot.',
    ),
  ];

  if (debtors.length > 0) content.push(debtorsTable(debtors));

  content.push(heading(3, LEDGER_HEADING), ledgerCodeBlock(records));

  return { type: 'doc', version: 1, content };
}

function debtorsTable(debtors: OpenDebtor[]): AdfNode {
  const header = tableRow([
    tableHeader('Person'),
    tableHeader('Pending'),
    tableHeader('Last pledge'),
    tableHeader('When (IST)'),
  ]);
  const rows = debtors.map((debtor) =>
    tableRow([
      tableCell(debtor.fullName),
      tableCell(String(debtor.openCount)),
      tableCell(lastPledgeText(debtor)),
      tableCell(formatIst(debtor.lastPledgedAt)),
    ]),
  );
  return {
    type: 'table',
    attrs: { isNumberColumnEnabled: false, layout: 'default' },
    content: [header, ...rows],
  };
}

function lastPledgeText(debtor: OpenDebtor): string {
  return debtor.openCount > 1
    ? `${debtor.openCount} pending`
    : 'pending snacks';
}

function ledgerCodeBlock(records: SnacksPledgeRecord[]): AdfNode {
  return {
    type: 'codeBlock',
    attrs: { language: 'json' },
    content: [{ type: 'text', text: JSON.stringify(records) }],
  };
}

function heading(level: number, text: string): AdfNode {
  return { type: 'heading', attrs: { level }, content: [textNode(text)] };
}

function paragraph(text: string): AdfNode {
  return { type: 'paragraph', content: [textNode(text)] };
}

function tableRow(cells: AdfNode[]): AdfNode {
  return { type: 'tableRow', content: cells };
}

function tableHeader(text: string): AdfNode {
  return { type: 'tableHeader', attrs: {}, content: [paragraph(text)] };
}

function tableCell(text: string): AdfNode {
  return { type: 'tableCell', attrs: {}, content: [paragraph(text)] };
}

function textNode(text: string): AdfNode {
  return { type: 'text', text };
}

function formatIst(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
