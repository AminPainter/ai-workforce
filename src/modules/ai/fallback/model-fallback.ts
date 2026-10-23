import { Logger } from '@nestjs/common';
import { APICallError, type LanguageModelMiddleware } from 'ai';
import { type OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { AiModel } from '../constants/ai-models';

type GatewayModel = ReturnType<OpenAICompatibleProvider>;
type GenerateOptions = Parameters<GatewayModel['doGenerate']>[0];
type GenerateResult = Awaited<ReturnType<GatewayModel['doGenerate']>>;

const COOLDOWN_MS = 5 * 60 * 1000;
const GATEWAY_FALLBACKS_HEADER = 'x-litellm-attempted-fallbacks';
const UNAVAILABLE_STATUS_CODES = new Set([404, 408, 429]);
const MODEL_ACCESS_DENIED_TYPE = /_model_access_denied$/;
const MAX_LOGGED_MESSAGE_LENGTH = 200;

export class ModelFallback {
  private readonly logger = new Logger(ModelFallback.name);
  private readonly cooldownUntil = new Map<AiModel, number>();

  constructor(
    private readonly resolveModel: (aiModel: AiModel) => GatewayModel,
  ) {}

  middleware(chain: AiModel[]): LanguageModelMiddleware {
    return {
      wrapGenerate: ({ params }) => this.generate(chain, params),
    };
  }

  private async generate(
    chain: AiModel[],
    params: GenerateOptions,
  ): Promise<GenerateResult> {
    const ordered = this.availableFirst(chain);
    let lastError: unknown;
    for (const [index, aiModel] of ordered.entries())
      try {
        const result = await this.resolveModel(aiModel).doGenerate(params);
        this.recordSuccess(aiModel, result);
        return result;
      } catch (error) {
        if (params.abortSignal?.aborted || !shouldFallBack(error)) throw error;
        if (isModelUnavailable(error)) this.coolDown(aiModel);
        lastError = error;
        const next = ordered[index + 1];
        this.logger.warn(
          `${aiModel} failed (${describe(error)}), ${next ? `falling back to ${next}` : 'no fallback left'}`,
        );
      }
    throw lastError;
  }

  // A gateway-side fallback still returns 200, but only after the model's
  // full gateway timeout, so the model is cooled down as if it had failed.
  private recordSuccess(aiModel: AiModel, result: GenerateResult): void {
    const gatewayFallbacks = Number(
      result.response?.headers?.[GATEWAY_FALLBACKS_HEADER] ?? 0,
    );
    if (gatewayFallbacks === 0) {
      this.cooldownUntil.delete(aiModel);
      return;
    }
    this.coolDown(aiModel);
    this.logger.warn(
      `${aiModel} was served by a gateway fallback, cooling it down`,
    );
  }

  private coolDown(aiModel: AiModel): void {
    this.cooldownUntil.set(aiModel, Date.now() + COOLDOWN_MS);
  }

  // Cooling-down models move to the end instead of being skipped, so a full
  // outage still gets one real attempt per model.
  private availableFirst(chain: AiModel[]): AiModel[] {
    const now = Date.now();
    const isCoolingDown = (aiModel: AiModel) =>
      (this.cooldownUntil.get(aiModel) ?? 0) > now;
    return [
      ...chain.filter((aiModel) => !isCoolingDown(aiModel)),
      ...chain.filter(isCoolingDown),
    ];
  }
}

// Mirrors the statuses LiteLLM's router cools a deployment down on: no
// response, timeout, rate limit, model not found, or any 5xx.
function isModelUnavailable(error: APICallError): boolean {
  const status = error.statusCode;
  return (
    status == null || status >= 500 || UNAVAILABLE_STATUS_CODES.has(status)
  );
}

// 400 is a per-model rejection on this gateway (unsupported field or param,
// context window, content policy, no healthy deployment). 401, 402 and 422
// are key-level auth/budget errors that every model would hit too.
function shouldFallBack(error: unknown): error is APICallError {
  if (!APICallError.isInstance(error)) return false;
  return (
    isModelUnavailable(error) ||
    error.statusCode === 400 ||
    (error.statusCode === 403 && isModelAccessDenied(error))
  );
}

function isModelAccessDenied(error: APICallError): boolean {
  const data = error.data as { error?: { type?: string | null } } | undefined;
  return MODEL_ACCESS_DENIED_TYPE.test(data?.error?.type ?? '');
}

function describe(error: APICallError): string {
  const message = error.message
    .split('\n')[0]
    .slice(0, MAX_LOGGED_MESSAGE_LENGTH);
  return `${error.statusCode ?? 'no response'}: ${message}`;
}
