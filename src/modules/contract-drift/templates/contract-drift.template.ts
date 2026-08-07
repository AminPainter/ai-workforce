import type { CardChild, ChatElement } from 'chat';
import type {
  ContractDriftReport,
  BreakingChange,
} from '../agent/contract-drift-detector.schema';

export interface ContractDriftContext {
  repoFullName: string;
  prNumber: number;
  mergeSha: string;
  baseRef: string;
  prUrl: string;
}

const MAX_RENDERED_CHANGES = 8;

const INTRO =
  'This merged PR ships a breaking change to an API response contract the frontend depends on. ' +
  'Each change below was confirmed against glomopay-checkout — the evidence is inline.';

function renderChange(change: BreakingChange): string {
  return [
    `*${change.file}*`,
    change.change,
    change.reason,
    `↳ ${change.evidence}`,
  ].join('\n');
}

export async function buildContractDriftCard(
  report: ContractDriftReport,
  context: ContractDriftContext,
): Promise<ChatElement> {
  const { Card, Section, CardText, Divider, CardLink } = await import('chat');

  const rendered = report.breakingChanges.slice(0, MAX_RENDERED_CHANGES);
  const overflow = report.breakingChanges.length - rendered.length;

  const children: CardChild[] = [
    Section([CardText(INTRO)]),
    Section([CardText(report.summary)]),
  ];

  children.push(Divider());
  for (const change of rendered)
    children.push(Section([CardText(renderChange(change))]));

  if (overflow > 0)
    children.push(
      Section([
        CardText(
          `+${overflow} more change${overflow === 1 ? '' : 's'} — see the diff.`,
        ),
      ]),
    );

  // Plain link, not an interactive button — a URL button fires a block_actions
  // interaction the app doesn't ack, which Slack surfaces as "cannot handle payload".
  children.push(CardLink({ url: context.prUrl, label: 'View PR' }));

  return Card({
    title: 'Breaking API contract change',
    subtitle: `${context.repoFullName}#${context.prNumber} (merged ${context.mergeSha})`,
    children,
  });
}
