/**
 * Standalone REPL harness for the customer-support AI agent loop.
 *
 * Boots a trimmed Nest context (AiModule + WebModule — no Redis, no Zoho queue) and
 * runs the real `createCustomerSupport` ToolLoopAgent against a fixture ticket,
 * mirroring what CustomerSupportProcessor does: run the agent, read `.text`,
 * and split on the NOT_A_SUPPORT_REQUEST marker.
 *
 * Run:
 *   pnpm cs:repl                                          # uses the built-in fixture
 *   pnpm cs:repl "subject" "customer msg"                 # ad-hoc ticket, no requester email
 *   pnpm cs:repl "subject" "customer msg" "j@example.com" # ad-hoc ticket with requester email
 *
 * Env required: AI_GATEWAY_API_KEY, AI_GATEWAY_BASE_URL, SEARXNG_BASE_URL,
 * ALLOYDB_MCP_URL, ALLOYDB_MCP_API_KEY, GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID,
 * GITHUB_APP_PRIVATE_KEY.
 * SENTRY_AUTH_TOKEN is optional — the MCP services swallow
 * connection failures and the agent runs with whatever tools connected.
 * The AlloyDB tools hit PRODUCTION. Every SQL query the agent runs is printed.
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AiModule } from '../src/modules/ai/ai.module.js';
import { AiService } from '../src/modules/ai/services/ai.service.js';
import { GitHubMcpService } from '../src/modules/ai/services/github-mcp.service.js';
import { SentryMcpService } from '../src/modules/ai/services/sentry-mcp.service.js';
import { AlloyDbMcpService } from '../src/modules/ai/services/alloydb-mcp.service.js';
import { WebModule } from '../src/modules/web/web.module.js';
import { WebToolsService } from '../src/modules/web/services/web-tools.service.js';
import { createCustomerSupport } from '../src/modules/customer-support/agent/customer-support.agent.js';
import { CUSTOMER_SUPPORT_NOT_A_REQUEST_MARKER } from '../src/modules/customer-support/agent/customer-support.prompt.js';
import type {
  ZohoConversationEntry,
  ZohoTicket,
} from '../src/modules/zoho/zoho.types.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AiModule, WebModule],
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
Requester email (from the Zoho ticket record): ${ticket.email || '(none)'}

Conversation (oldest to newest):
${body}

Write a draft reply to the newest customer message. Research with your tools first, then draft.`;
}

async function main(): Promise<void> {
  const [subjectArg, messageArg, emailArg] = process.argv.slice(2);

  const ticket: ZohoTicket = {
    id: 'repl-1',
    subject: subjectArg ?? 'Card declined on international transaction',
    description:
      messageArg ??
      'Hi, my GlomoPay card keeps getting declined when I try to pay in USD on international sites, but domestic works fine. Nothing changed on my end. Can you help?',
    email: emailArg ?? '',
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
    app.get(AlloyDbMcpService),
    app.get(WebToolsService),
  );

  const task = buildDraftTask(ticket, conversation);
  console.log('\n===== TASK =====\n' + task + '\n');

  const started = Date.now();
  const result = (await agent.generate({
    messages: [{ role: 'user', content: task }],
    onStepFinish: (step: {
      toolCalls?: { toolName: string; input?: unknown }[];
      text?: string;
    }) => {
      const calls = (step.toolCalls ?? []).map((c) => c.toolName).join(', ');
      console.log(`[step] tools=[${calls}] textLen=${step.text?.length ?? 0}`);
      for (const call of step.toolCalls ?? [])
        if (call.toolName === 'teleport_postgres_query')
          console.log(`[sql] ${JSON.stringify(call.input)}`);
    },
  })) as {
    text: string;
    steps?: unknown[];
  };

  const reply = result.text.trim();
  console.log('\n===== OUTPUT =====');
  if (reply.startsWith(CUSTOMER_SUPPORT_NOT_A_REQUEST_MARKER))
    console.log(
      'DISQUALIFIED:',
      reply.slice(CUSTOMER_SUPPORT_NOT_A_REQUEST_MARKER.length).trim(),
    );
  else console.log(reply);

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
