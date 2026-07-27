import type { CardChild, ChatElement } from 'chat';
import type { ContractDriftReport } from '../../agents/workforce/contract-drift-detector/contract-drift-detector.schema';

export interface ContractDriftContext {
  repoFullName: string;
  prNumber: number;
  mergeSha: string;
  baseRef: string;
  prUrl: string;
}

const MAX_RENDERED_CHANGES = 8;

const INTRO =
  'This merged PR may change an API response contract the frontend depends on. ' +
  'Please review the drift below and confirm with the frontend team before deploying.';

export async function buildContractDriftCard(
  report: ContractDriftReport,
  context: ContractDriftContext,
): Promise<ChatElement> {
  const { Card, Section, CardText, Divider, CardLink } = await import('chat');

  const rendered = report.driftingChanges.slice(0, MAX_RENDERED_CHANGES);
  const overflow = report.driftingChanges.length - rendered.length;

  const children: CardChild[] = [
    Section([CardText(INTRO)]),
    Section([CardText(report.summary)]),
  ];

  children.push(Divider());
  for (const change of rendered)
    children.push(
      Section([
        CardText(`*${change.file}*\n${change.change}\n${change.reason}`),
      ]),
    );

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
    title: 'Contract drift detected',
    subtitle: `${context.repoFullName}#${context.prNumber} (merged ${context.mergeSha})`,
    children,
  });
}
