/**
 * Standalone harness for the Form 9 classifier + mapping pipeline.
 *
 * Boots a trimmed Nest context (AiModule only — no Redis, no Zoho) and runs the
 * real `createForm9Classifier` ToolLoopAgent to pick a taxonomy node, then runs
 * the deterministic `lookupForm9` mapping — mirroring what Form9Processor does.
 *
 * Run:
 *   pnpm f9:repl                            # runs the worked-example suite
 *   pnpm f9:repl "subject" "customer msg"   # ad-hoc single ticket
 *
 * Env required: AI_GATEWAY_API_KEY, AI_GATEWAY_BASE_URL, AI_GATEWAY_MODEL.
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AiModule } from '../src/modules/ai/ai.module';
import { AiService } from '../src/modules/ai/services/ai.service';
import { createForm9Classifier } from '../src/modules/form9/agent/form9-classifier.agent';
import type { Form9Taxonomy } from '../src/modules/form9/agent/form9-classifier.schema';
import {
  lookupForm9,
  type Form9Derivation,
} from '../src/modules/form9/mapping/form9-mapping';
import type {
  ZohoConversationEntry,
  ZohoTicket,
} from '../src/modules/zoho/zoho.types';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AiModule],
})
class ReplModule {}

// Same shape Form9Processor.buildClassifyTask produces.
function buildClassifyTask(
  ticket: ZohoTicket,
  conversation: ZohoConversationEntry[],
): string {
  const transcript = conversation
    .map((entry) => {
      const who =
        entry.direction === 'in'
          ? 'Customer'
          : entry.direction === 'out'
            ? 'Support'
            : (entry.author ?? entry.type);
      return `${who}: ${entry.content}`;
    })
    .join('\n\n');

  const body =
    transcript ||
    (ticket.description ? `Customer: ${ticket.description}` : '') ||
    '(no conversation content available)';

  return `Ticket subject: ${ticket.subject}

Conversation (oldest to newest):
${body}

Classify this ticket into a taxonomy node (L1 > L2 > L3).`;
}

interface Fixture {
  name: string;
  subject: string;
  message: string;
  expect: {
    reportable: string;
    serviceType: string;
    complaintType: string;
  };
}

const FIXTURES: Fixture[] = [
  {
    name: 'funds debited not credited',
    subject: 'Money sent but not received',
    message:
      'I initiated a remittance two days ago, the money left my bank account, but the beneficiary abroad has still not received anything.',
    expect: {
      reportable: 'Complaint',
      serviceType: 'Cross border money transfer',
      complaintType: '11 Delay in loading/crediting',
    },
  },
  {
    name: 'settlement schedule question',
    subject: 'When will settlement land?',
    message:
      'Just checking when the settlement for last Tuesday’s batch is scheduled to hit our account?',
    expect: {
      reportable: 'Service request',
      serviceType: 'Merchant acquisition',
      complaintType: 'NA Not applicable',
    },
  },
  {
    name: 'insufficient funds in own bank',
    subject: 'Payin failed',
    message:
      'I tried to pay in but it failed. My bank said there were insufficient funds in my account at the time.',
    expect: {
      reportable: 'Not applicable',
      serviceType: 'Cross border money transfer',
      complaintType: 'NA Not applicable',
    },
  },
  {
    name: 'CKYC old mobile',
    subject: 'OTP not reaching me',
    message:
      'My CKYC record still has my old mobile number so the OTP never reaches me and I cannot proceed. Please update it.',
    expect: {
      reportable: 'Complaint',
      serviceType: 'Cross border money transfer',
      complaintType: '04 Non-updation of mobile number/address',
    },
  },
  {
    name: 'partner bank maintenance page (Others)',
    subject: 'Cannot authenticate payin',
    message:
      'When I try to authenticate the payin on my bank’s page, it just shows a "site under maintenance" screen. Nothing is wrong with my credentials.',
    expect: {
      reportable: 'Complaint',
      serviceType: 'Cross border money transfer',
      complaintType: '13 Others',
    },
  },
  {
    name: 'duplicate card debit on subscription',
    subject: 'Charged twice',
    message:
      'My card was charged twice for the same subscription cycle this month. Please reverse the extra charge.',
    expect: {
      reportable: 'Complaint',
      serviceType: 'Merchant acquisition',
      complaintType: '05 Amount not credited back to source',
    },
  },
  {
    name: 'folio not allotted after payment',
    subject: 'No folio after payment',
    message:
      'I completed the investment payment but no folio has been allotted to me yet.',
    expect: {
      reportable: 'Complaint',
      serviceType: 'Cross border money transfer',
      complaintType: '12 Non-delivery of goods/services from merchant',
    },
  },
];

function fmtDerivation(d: Form9Derivation): string {
  const others =
    d.complaintType === '13 Others'
      ? ` [${[d.matchedIssueType2, d.matchedIssueType3].filter(Boolean).join(' > ')}]`
      : '';
  return `${d.reportable} / ${d.serviceType} / ${d.complaintType}${others}`;
}

async function main(): Promise<void> {
  const [subjectArg, messageArg] = process.argv.slice(2);

  const app = await NestFactory.createApplicationContext(ReplModule, {
    logger: ['error', 'warn'],
  });
  const agent = createForm9Classifier(app.get(AiService));

  const classify = async (
    subject: string,
    message: string,
  ): Promise<{ taxonomy: Form9Taxonomy; derivation?: Form9Derivation }> => {
    const task = buildClassifyTask(
      { id: 'repl-1', subject, description: message },
      [
        {
          type: 'thread',
          direction: 'in',
          author: 'customer',
          content: message,
        },
      ],
    );
    const { output: taxonomy } = (await agent.generate({
      messages: [{ role: 'user', content: task }],
    })) as { output: Form9Taxonomy };
    const derivation = lookupForm9(
      taxonomy.issueType1,
      taxonomy.issueType2,
      taxonomy.issueType3,
    );
    return { taxonomy, derivation };
  };

  const taxoStr = (t: Form9Taxonomy): string =>
    [t.issueType1, t.issueType2, t.issueType3].filter(Boolean).join(' > ');

  if (subjectArg && messageArg) {
    const { taxonomy, derivation } = await classify(subjectArg, messageArg);
    console.log('\ntaxonomy:', taxoStr(taxonomy));
    console.log(
      'form9:   ',
      derivation ? fmtDerivation(derivation) : '(no mapping match)',
    );
    console.log('reasoning:', taxonomy.reasoning);
    await app.close();
    return;
  }

  let passed = 0;
  for (const f of FIXTURES) {
    const { taxonomy, derivation } = await classify(f.subject, f.message);
    const ok =
      derivation !== undefined &&
      derivation.reportable === f.expect.reportable &&
      derivation.serviceType === f.expect.serviceType &&
      derivation.complaintType === f.expect.complaintType;
    if (ok) passed++;
    console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${f.name}`);
    console.log(`  taxonomy: ${taxoStr(taxonomy)}`);
    console.log(
      `  got:      ${derivation ? fmtDerivation(derivation) : '(no mapping match)'}`,
    );
    if (!ok)
      console.log(
        `  expected: ${f.expect.reportable} / ${f.expect.serviceType} / ${f.expect.complaintType}`,
      );
  }
  console.log(`\n${passed}/${FIXTURES.length} matched`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
