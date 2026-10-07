/**
 * Golden-set harness for the #leaves classifier + deterministic planner.
 *
 * Boots a trimmed Nest context (AiModule only — no Redis, Slack or RazorpayX),
 * builds the same classifier input LeaveMessageContextService produces, runs
 * the real classifier and then planLeaveRequest, mirroring LeaveTrackerProcessor.
 *
 * Run:
 *   pnpm leaves:repl                          # runs the fixture suite
 *   pnpm leaves:repl "message" [postedAtISO]  # ad-hoc single message
 *
 * Env required: AI_GATEWAY_API_KEY, AI_GATEWAY_BASE_URL, AI_GATEWAY_MODEL.
 * Fixtures are anonymized paraphrases of real #leaves phrasing.
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AiModule } from '../src/modules/ai/ai.module';
import { AiService } from '../src/modules/ai/services/ai.service';
import { toIstDateString } from '../src/common/utils/date.util';
import { createLeaveRequestClassifier } from '../src/modules/leave-tracker/agents/leave-request-classifier.agent';
import type { LeaveRequestClassification } from '../src/modules/leave-tracker/agents/leave-request-classifier.schema';
import {
  formatClassifierInput,
  type ClassifierContextMessage,
} from '../src/modules/leave-tracker/utils/classifier-input';
import {
  planLeaveRequest,
  type LeavePlan,
} from '../src/modules/leave-tracker/utils/leave-plan';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AiModule],
})
class ReplModule {}

// Wednesday 2026-10-07, 09:30 IST.
const NOW = new Date('2026-10-07T09:30:00+05:30');
const AUTHOR_ID = 'U0AUTHOR01';
const COLLEAGUE_ID = 'U0COLLEAG1';

interface Fixture {
  name: string;
  text: string;
  postedAt: string;
  isAdmin?: boolean;
  mentioned?: Array<[string, string]>;
  context?: Array<
    Omit<ClassifierContextMessage, 'postedAt'> & { postedAt: string }
  >;
  expect: {
    intent: LeaveRequestClassification['intent'];
    // "YYYY-MM-DD kind portion"; kind may be "*" when either reading is acceptable.
    marks?: string[];
    reverts?: string[];
    subject?: string;
  };
}

const FIXTURES: Fixture[] = [
  {
    name: 'wfh today',
    text: 'Will be WFH today @Platform',
    postedAt: '2026-10-07T07:44:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 wfh full'] },
  },
  {
    name: 'sick leave today',
    text: '@Team still having fever, so taking sick leave today.',
    postedAt: '2026-10-07T07:28:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 sick full'] },
  },
  {
    name: 'late start',
    text: 'Got some personal work, will be in office at around 11/11.30 am ish @Team',
    postedAt: '2026-10-07T06:51:00+05:30',
    expect: { intent: 'ignore' },
  },
  {
    name: 'OOO after bad night',
    text: "will be OOO today, couldn't sleep through the night because of random pages.",
    postedAt: '2026-10-07T05:51:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 * full'] },
  },
  {
    name: 'wfh tomorrow posted in the evening',
    text: 'Team, will WFH tomorrow.\ncc: @Backend',
    postedAt: '2026-10-06T19:50:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 wfh full'] },
  },
  {
    name: 'reaching late',
    text: 'Will be reaching late to office, have started from home.',
    postedAt: '2026-10-07T10:34:00+05:30',
    expect: { intent: 'ignore' },
  },
  {
    name: 'wfh with early logout',
    text: 'WFH today and will logout early by 4 pm. @Payments',
    postedAt: '2026-10-07T07:52:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 wfh full'] },
  },
  {
    name: 'range plus half day',
    text: 'Will be on leave from Oct 19 to 23.\n\nAnd 2nd half leave on Oct 16.\n\ncc @Team',
    postedAt: '2026-10-05T11:30:00+05:30',
    expect: {
      intent: 'mark',
      marks: [
        '2026-10-16 earned second_half',
        '2026-10-19 earned full',
        '2026-10-20 earned full',
        '2026-10-21 earned full',
        '2026-10-22 earned full',
        '2026-10-23 earned full',
      ],
    },
  },
  {
    name: 'wfh range for a wedding',
    text: "Team: I'll be WFH from 19th to 23rd October. Going to hometown for cousin's wedding.",
    postedAt: '2026-10-05T09:20:00+05:30',
    expect: {
      intent: 'mark',
      marks: [
        '2026-10-19 wfh full',
        '2026-10-20 wfh full',
        '2026-10-21 wfh full',
        '2026-10-22 wfh full',
        '2026-10-23 wfh full',
      ],
    },
  },
  {
    name: 'mixed leave and remote ranges',
    text: "Team, I'll be on leave on 9th and 11th November, and will be working remotely from 2nd–6th November and 12th–13th November.",
    postedAt: '2026-10-04T08:36:00+05:30',
    expect: {
      intent: 'mark',
      marks: [
        '2026-11-02 wfh full',
        '2026-11-03 wfh full',
        '2026-11-04 wfh full',
        '2026-11-05 wfh full',
        '2026-11-06 wfh full',
        '2026-11-09 earned full',
        '2026-11-11 earned full',
        '2026-11-12 wfh full',
        '2026-11-13 wfh full',
      ],
    },
  },
  {
    name: 'first half off',
    text: "Couldn't sleep last night, taking first half off. Will be available in a few hours.",
    postedAt: '2026-10-07T08:52:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 * first_half'] },
  },
  {
    name: 'AFK first half',
    text: "Team, will be AFK in the 1st half for a doctor's appointment",
    postedAt: '2026-10-07T08:37:00+05:30',
    expect: { intent: 'ignore' },
  },
  {
    name: 'bare bump',
    text: 'Bumping this up',
    postedAt: '2026-10-05T14:30:00+05:30',
    expect: { intent: 'ignore' },
  },
  {
    name: 'AFK few hours',
    text: 'Will be AFK for few hours @Team',
    postedAt: '2026-10-07T14:49:00+05:30',
    expect: { intent: 'ignore' },
  },
  {
    name: 'three listed dates',
    text: 'Team, I will be taking 3 days of leave on Nov 16, 17, 18.',
    postedAt: '2026-09-30T10:32:00+05:30',
    expect: {
      intent: 'mark',
      marks: [
        '2026-11-16 earned full',
        '2026-11-17 earned full',
        '2026-11-18 earned full',
      ],
    },
  },
  {
    name: 'struck-through tentative leave',
    text: "Hi Team,\n\n~I'll be tentatively taking leave from 25th - 30Oct. Will confirm the dates by EOW.~",
    postedAt: '2026-09-30T10:29:00+05:30',
    expect: { intent: 'ignore' },
  },
  {
    name: 'appointment window',
    text: "Tomorrow I'll have to step out for an appointment during 11:30am to 1pm.",
    postedAt: '2026-10-06T21:12:00+05:30',
    expect: { intent: 'ignore' },
  },
  {
    name: 'wfh tomorrow and leave later',
    text: 'Team will WFH tomorrow and taking leave on 9th oct.\ncc: @Backend',
    postedAt: '2026-10-06T19:03:00+05:30',
    expect: {
      intent: 'mark',
      marks: ['2026-10-07 wfh full', '2026-10-09 earned full'],
    },
  },
  {
    name: 'SL abbreviation',
    text: "I am feeling very weak, don't have the energy to do the work. I'll be on SL today.",
    postedAt: '2026-10-07T12:20:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 sick full'] },
  },
  {
    name: 'ill but working from home',
    text: 'Having cold and mild fever since last night. Will be doing wfh and will take the day slow.',
    postedAt: '2026-10-07T09:22:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 wfh full'] },
  },
  {
    name: 'leave then wfh on following days',
    text: 'i will be on leave on 7th October.\n\nAlso will WFH on 8th and 9th of October.',
    postedAt: '2026-09-28T18:00:00+05:30',
    expect: {
      intent: 'mark',
      marks: [
        '2026-10-07 earned full',
        '2026-10-08 wfh full',
        '2026-10-09 wfh full',
      ],
    },
  },
  {
    name: 'weekday names',
    text: 'I will be on leave on *Tuesday and Wednesday* due to some work at home, for which I need to travel.',
    postedAt: '2026-10-05T16:12:00+05:30',
    expect: {
      intent: 'mark',
      marks: ['2026-10-06 earned full', '2026-10-07 earned full'],
    },
  },
  {
    name: 'period leave',
    text: 'Having bad cramps. Taking the day off.\nwill join urgent meetings or calls.',
    postedAt: '2026-10-07T09:10:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 period full'] },
  },
  {
    name: 'stomach ache is sick not period',
    text: 'Bad stomach ache, taking sick leave today',
    postedAt: '2026-10-07T08:10:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 sick full'] },
  },
  {
    name: 'conditional',
    text: "my car is not starting, will reach by 11.30 if it's battery issue else will do WFH",
    postedAt: '2026-10-07T08:49:00+05:30',
    expect: { intent: 'clarify' },
  },
  {
    name: 'vague duration',
    text: 'My grandmother is unwell and I need to travel to my hometown urgently. I may need to take leave for the next 2–3 days, depending on the situation.',
    postedAt: '2026-10-07T09:25:00+05:30',
    expect: { intent: 'clarify' },
  },
  {
    name: 'same-day wfh cancel',
    text: 'Cancelling WFH, feeling better',
    postedAt: '2026-10-07T09:20:00+05:30',
    expect: { intent: 'cancel', reverts: ['2026-10-07'] },
  },
  {
    name: 'cancel and replace',
    text: "There's a change of plan, something came up, so I'll cancel my leave on the 15th and 16th and instead take leave on 21st and 22nd.",
    postedAt: '2026-10-06T19:39:00+05:30',
    expect: {
      intent: 'cancel_and_mark',
      marks: ['2026-10-21 earned full', '2026-10-22 earned full'],
      reverts: ['2026-10-15', '2026-10-16'],
    },
  },
  {
    name: 'admin marks for someone',
    text: 'Mark sick leave today for @Colleague',
    postedAt: '2026-10-07T08:48:00+05:30',
    isAdmin: true,
    mentioned: [[COLLEAGUE_ID, 'Colleague']],
    expect: {
      intent: 'mark',
      subject: COLLEAGUE_ID,
      marks: ['2026-10-07 sick full'],
    },
  },
  {
    name: 'cc is not the subject',
    text: "I'll be on leave tomorrow.\n\ncc: @Colleague @Team",
    postedAt: '2026-10-06T20:50:00+05:30',
    mentioned: [[COLLEAGUE_ID, 'Colleague']],
    expect: { intent: 'mark', marks: ['2026-10-07 earned full'] },
  },
  {
    name: 'optional leave',
    text: 'I will be taking the optional leave tomorrow',
    postedAt: '2026-10-06T22:59:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 optional full'] },
  },
  {
    name: 'half-day leave then wfh same day',
    text: 'Something urgent came up at home. So I will be on half day leave in the first half tomorrow and will wfh post that.',
    postedAt: '2026-10-06T21:54:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 earned first_half'] },
  },
  {
    name: 'wfh first half',
    text: 'I will be WFH in first half and will come office post that.',
    postedAt: '2026-10-06T23:55:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-07 wfh first_half'] },
  },
  {
    name: 'thread reply cancels own post',
    text: 'This is cancelled. Might take sick leave or WFH depending upon health.',
    postedAt: '2026-10-06T21:55:00+05:30',
    context: [
      {
        heading:
          'This message is a reply in a thread. The thread starts with written by the same author.',
        text: 'Will be on leave tomorrow.',
        postedAt: '2026-10-06T18:00:00+05:30',
        recordedEntries: [
          { date: '2026-10-07', kind: 'earned', portion: 'full' },
        ],
      },
    ],
    expect: { intent: 'cancel', reverts: ['2026-10-07'] },
  },
  {
    name: 'answer to clarification',
    text: '7th to 9th',
    postedAt: '2026-10-07T09:28:00+05:30',
    context: [
      {
        heading:
          'Earlier, the author posted the message below and the bot asked them: "Which exact dates should I mark as leave?". The current message is their answer.',
        text: 'My grandmother is unwell and I need to travel to my hometown urgently. I may need to take leave for the next 2–3 days, depending on the situation.',
        postedAt: '2026-10-07T09:25:00+05:30',
        recordedEntries: [],
      },
    ],
    expect: {
      intent: 'mark',
      marks: ['2026-10-07 * full', '2026-10-08 * full', '2026-10-09 * full'],
    },
  },
  {
    name: 'concrete part of a partly vague plan',
    text: "I'll be OOO from 29 Oct - 3 Nov. Then will wfh for the next one and a half week or so during diwali. Then will be OOO around 11 Dec to 16 dec or so, will confirm the exact dates then.",
    postedAt: '2026-09-24T11:56:00+05:30',
    expect: {
      intent: 'mark',
      marks: [
        '2026-10-29 earned full',
        '2026-10-30 earned full',
        '2026-11-02 earned full',
        '2026-11-03 earned full',
      ],
    },
  },
  {
    name: 'own wedding with mixed types',
    text: 'Hey team, going on leave for my wedding.\n\n10 & 25 Nov — WFH\n11 & 24 Nov — Earned Leave\n16–18 Nov — Marriage Leave\n\nBack in office on 30 Nov.',
    postedAt: '2026-10-05T17:53:00+05:30',
    expect: {
      intent: 'mark',
      marks: [
        '2026-11-10 wfh full',
        '2026-11-11 earned full',
        '2026-11-16 marriage full',
        '2026-11-17 marriage full',
        '2026-11-18 marriage full',
        '2026-11-24 earned full',
        '2026-11-25 wfh full',
      ],
    },
  },
  {
    name: 'early logoff tomorrow',
    text: 'Will be logging off at 3pm tomorrow. Travelling to Bangalore.',
    postedAt: '2026-10-06T09:00:00+05:30',
    expect: { intent: 'ignore' },
  },
  {
    name: 'this friday with date',
    text: 'Team - I will be on leave this Friday (9th Oct)',
    postedAt: '2026-10-05T14:36:00+05:30',
    expect: { intent: 'mark', marks: ['2026-10-09 earned full'] },
  },
];

function planToStrings(plan: LeavePlan): {
  marks: string[];
  reverts: string[];
} {
  return {
    marks: plan.marks.map(
      ({ date, kind, portion }) => `${date} ${kind} ${portion}`,
    ),
    reverts: plan.reverts.map(({ date }) => date),
  };
}

function marksMatch(actual: string[], expected: string[]): boolean {
  if (actual.length !== expected.length) return false;
  return expected.every((want, index) => {
    const [wantDate, wantKind, wantPortion] = want.split(' ');
    const [date, kind, portion] = actual[index].split(' ');
    return (
      date === wantDate &&
      portion === wantPortion &&
      (wantKind === '*' || kind === wantKind)
    );
  });
}

async function main(): Promise<void> {
  const [textArg, postedAtArg] = process.argv.slice(2);
  const app = await NestFactory.createApplicationContext(ReplModule, {
    logger: ['error', 'warn'],
  });
  const agent = createLeaveRequestClassifier(app.get(AiService));
  const today = toIstDateString(NOW);

  const classify = async (fixture: Omit<Fixture, 'name' | 'expect'>) => {
    const input = formatClassifierInput({
      now: NOW,
      postedAt: new Date(fixture.postedAt),
      authorName: 'Employee',
      authorUserId: AUTHOR_ID,
      isAdmin: fixture.isAdmin ?? false,
      text: fixture.text,
      mentionedUsers: new Map(fixture.mentioned ?? []),
      contextMessages: (fixture.context ?? []).map((context) => ({
        ...context,
        postedAt: new Date(context.postedAt),
      })),
    });
    const { output } = (await agent.generate({
      messages: [{ role: 'user', content: input }],
    })) as { output: LeaveRequestClassification };
    return { output, plan: planLeaveRequest(output, today) };
  };

  if (textArg) {
    const { output, plan } = await classify({
      text: textArg,
      postedAt: postedAtArg ?? NOW.toISOString(),
    });
    console.log(JSON.stringify(output, null, 2));
    console.log(JSON.stringify(planToStrings(plan), null, 2));
    await app.close();
    return;
  }

  let passed = 0;
  for (const fixture of FIXTURES) {
    const { output, plan } = await classify(fixture);
    const actual = planToStrings(plan);
    const actualSubject =
      output.subjectSlackUserId === AUTHOR_ID
        ? null
        : output.subjectSlackUserId;
    const expectedMarks = fixture.expect.marks ?? [];
    const expectedReverts = fixture.expect.reverts ?? [];
    const ok =
      output.intent === fixture.expect.intent &&
      marksMatch(actual.marks, expectedMarks) &&
      JSON.stringify(actual.reverts) === JSON.stringify(expectedReverts) &&
      (fixture.expect.subject ?? null) === actualSubject;
    if (ok) passed++;
    console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${fixture.name}`);
    if (!ok) {
      console.log(
        `  expected: ${fixture.expect.intent} marks=${JSON.stringify(expectedMarks)} reverts=${JSON.stringify(expectedReverts)}${fixture.expect.subject ? ` subject=${fixture.expect.subject}` : ''}`,
      );
      console.log(
        `  got:      ${output.intent} marks=${JSON.stringify(actual.marks)} reverts=${JSON.stringify(actual.reverts)} subject=${actualSubject}`,
      );
      console.log(`  reason:   ${output.reason}`);
    }
  }
  console.log(`\n${passed}/${FIXTURES.length} matched`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
