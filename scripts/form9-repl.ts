/**
 * Standalone harness for the Form 9 classifier agent.
 *
 * Boots a trimmed Nest context (AiModule only — no Redis, no Zoho) and runs the
 * real `createForm9Classifier` ToolLoopAgent against fixture tickets, mirroring
 * what Form9Processor does: build the classify task, run the agent, read
 * `.output`.
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
import type { Form9Classification } from '../src/modules/form9/agent/form9-classifier.schema';
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

Classify this ticket's Form 9 fields.`;
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
    // serviceType follows the rail (LRS payin), not reportable — "Not applicable"
    // service type is reserved for L1 "Not an Issue" only.
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
];

function fmt(c: Form9Classification): string {
  return `${c.reportable} / ${c.serviceType} / ${c.complaintType}${
    c.complaintType === '13 Others' ? ` [${c.othersDetail}]` : ''
  }`;
}

async function main(): Promise<void> {
  const [subjectArg, messageArg] = process.argv.slice(2);

  const app = await NestFactory.createApplicationContext(ReplModule, {
    logger: ['error', 'warn'],
  });
  const agent = createForm9Classifier(app.get(AiService));

  const run = async (
    subject: string,
    message: string,
  ): Promise<Form9Classification> => {
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
    const { output } = (await agent.generate({
      messages: [{ role: 'user', content: task }],
    })) as { output: Form9Classification };
    return output;
  };

  if (subjectArg && messageArg) {
    const out = await run(subjectArg, messageArg);
    console.log('\n' + fmt(out));
    console.log('reasoning:', out.reasoning);
    await app.close();
    return;
  }

  let passed = 0;
  for (const f of FIXTURES) {
    const out = await run(f.subject, f.message);
    const ok =
      out.reportable === f.expect.reportable &&
      out.serviceType === f.expect.serviceType &&
      out.complaintType === f.expect.complaintType;
    if (ok) passed++;
    console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${f.name}`);
    console.log(`  got:      ${fmt(out)}`);
    if (!ok)
      console.log(
        `  expected: ${f.expect.reportable} / ${f.expect.serviceType} / ${f.expect.complaintType}`,
      );

    console.log(`  reasoning: ${out.reasoning}`);
  }
  console.log(`\n${passed}/${FIXTURES.length} matched`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
