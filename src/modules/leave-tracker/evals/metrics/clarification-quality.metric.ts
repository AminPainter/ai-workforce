import { GEval } from 'deepeval/metrics';
import type { DeepEvalBaseLLM } from 'deepeval/models';
import { SingleTurnParams } from 'deepeval/test-case';

export class ClarificationQualityMetric extends GEval {
  constructor(judge: DeepEvalBaseLLM) {
    super({
      name: 'Clarification Quality',
      model: judge,
      threshold: 0.7,
      evaluationParams: [
        SingleTurnParams.INPUT,
        SingleTurnParams.ACTUAL_OUTPUT,
      ],
      evaluationSteps: [
        'Context: the input is a Slack message from an employee in the #leaves channel. The bot\'s only job is to mark the author\'s leave or work-from-home (WFH) days in payroll. It asks a clarification question when the message is conditional or vague about dates or type. The actual output is JSON whose "clarificationQuestion" is what the bot posts back in the thread; judge only that question.',
        'Check the question targets the specific uncertainty in the message (e.g. which of two conditional outcomes happened, which exact dates, full or half day, leave or WFH) and does not ask for anything the message already states. Asking whether to mark a day as leave or WFH is expected and fine.',
        'Check it is a single short question addressed to the author, in plain conversational language.',
        'Penalize any promise of actions beyond marking leave or WFH, such as cancelling leave, showing leave balances or approving leave.',
        'Penalize internal or technical terms such as RazorpayX, leave-type codes, intents, JSON or schema field names.',
        'Penalize any mention or repetition of health or personal details from the message.',
      ],
    });
  }
}
