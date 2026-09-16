/**
 * Standalone REPL harness for the customer-support AI agent loop.
 *
 * Boots a trimmed Nest context (AiModule only — no Redis, no Zoho queue) and
 * runs the real `createCustomerSupport` ToolLoopAgent against a fixture ticket,
 * mirroring what CustomerSupportProcessor does: run the agent, read `.text`,
 * and split on the NOT_A_SUPPORT_REQUEST marker.
 *
 * Run:
 *   pnpm cs:repl                          # uses the built-in fixture
 *   pnpm cs:repl "subject" "customer msg" # ad-hoc ticket
 *
 * Env required: AI_GATEWAY_API_KEY, AI_GATEWAY_BASE_URL, AI_GATEWAY_MODEL, SEARXNG_BASE_URL.
 * GITHUB_PAT / SENTRY_AUTH_TOKEN are optional — the MCP services swallow
 * connection failures and the agent runs with whatever tools connected.
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AiModule } from '../src/modules/ai/ai.module';
import { AiService } from '../src/modules/ai/services/ai.service';
import { GitHubMcpService } from '../src/modules/ai/services/github-mcp.service';
import { SentryMcpService } from '../src/modules/ai/services/sentry-mcp.service';
import { createCustomerSupport } from '../src/modules/customer-support/agent/customer-support.agent';
import { CUSTOMER_SUPPORT_NOT_A_REQUEST_MARKER } from '../src/modules/customer-support/agent/customer-support.prompt';
import type {
  ZohoConversationEntry,
  ZohoTicket,
} from '../src/modules/zoho/zoho.types';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AiModule],
})
class ReplModule {}

// Same shape CustomerSupportProcessor.buildDraftTask produces.
function buildDraftTask(
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

Write a draft reply to the newest customer message. Research with your tools first, then draft.`;
}

async function main(): Promise<void> {
  const [subjectArg, messageArg] = process.argv.slice(2);

  const ticket: ZohoTicket = {
    id: 'repl-1',
    subject: subjectArg ?? 'Card declined on international transaction',
    description:
      messageArg ??
      'Hi, my GlomoPay card keeps getting declined when I try to pay in USD on international sites, but domestic works fine. Nothing changed on my end. Can you help?',
  };

  const conversation: ZohoConversationEntry[] = [
    {
      type: 'thread',
      direction: 'in',
      author: 'customer',
      content: ticket.description,
    },
  ];

  const app = await NestFactory.createApplicationContext(ReplModule, {
    logger: ['error', 'warn', 'log'],
  });

  const agent = createCustomerSupport(
    app.get(AiService),
    app.get(GitHubMcpService),
    app.get(SentryMcpService),
  );

  const task = buildDraftTask(ticket, conversation);
  console.log('\n===== TASK =====\n' + task + '\n');

  const started = Date.now();
  const result = (await agent.generate({
    messages: [{ role: 'user', content: task }],
    onStepFinish: (step: {
      toolCalls?: { toolName: string }[];
      text?: string;
    }) => {
      const calls = (step.toolCalls ?? []).map((c) => c.toolName).join(', ');
      console.log(`[step] tools=[${calls}] textLen=${step.text?.length ?? 0}`);
    },
  } as Parameters<typeof agent.generate>[0])) as {
    text: string;
    steps?: unknown[];
  };

  const reply = result.text.trim();
  console.log('\n===== OUTPUT =====');
  if (reply.startsWith(CUSTOMER_SUPPORT_NOT_A_REQUEST_MARKER)) {
    console.log(
      'DISQUALIFIED:',
      reply.slice(CUSTOMER_SUPPORT_NOT_A_REQUEST_MARKER.length).trim(),
    );
  } else {
    console.log(reply);
  }
  console.log(
    `\nsteps: ${result.steps?.length ?? '?'}  |  ${(
      (Date.now() - started) /
      1000
    ).toFixed(1)}s`,
  );

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
