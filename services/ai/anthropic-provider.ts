import 'server-only';
import { env } from '@/config/env';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { MedicineContent } from '@/types/medicine';
import {
  SYSTEM_PROMPT,
  buildAnswerPrompt,
  buildExplainPrompt,
  buildTranslatePrompt,
} from './prompts';
import {
  noVerifiedInfoMessage,
  refusalMessage,
  screenAnswer,
  screenQuestion,
} from './safety';
import type {
  AiAnswer,
  AiProvider,
  AnswerRequest,
  ExplainRequest,
  TranslateRequest,
} from './types';

/**
 * Claude-backed provider.
 *
 * REQUIRES CREDENTIALS: set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY.
 *
 * The model never sees anything except the verified record and the user's
 * question. `screenQuestion` runs before the call and `screenAnswer` after it,
 * so an off-policy generation is replaced by the standard referral message
 * rather than shown to the user.
 */
export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic';

  isConfigured(): boolean {
    return env.ANTHROPIC_API_KEY.trim().length > 0;
  }

  private async complete(prompt: string, maxTokens: number): Promise<string> {
    if (!this.isConfigured()) {
      throw new AppError(ERROR_CODES.FEATURE_DISABLED, {
        logContext: { provider: this.name, reason: 'ANTHROPIC_API_KEY is empty' },
      });
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: env.ANTHROPIC_MODEL,
          max_tokens: maxTokens,
          temperature: 0,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) throw new Error(`Anthropic API responded ${response.status}`);

      const body = (await response.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text = (body.content ?? [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('')
        .trim();

      if (!text) throw new Error('Empty completion');
      return text;
    } catch (e) {
      logger.error('Anthropic request failed', { error: (e as Error).name });
      throw new AppError(ERROR_CODES.AI_FAILED, { cause: e, logContext: { provider: this.name } });
    }
  }

  async explain(request: ExplainRequest): Promise<AiAnswer> {
    const text = await this.complete(buildExplainPrompt(request.medicine, request.language), 700);
    const verdict = screenAnswer(text);
    if (!verdict.allowed) {
      logger.warn('AI explanation blocked by output screen', { provider: this.name });
      return {
        text: refusalMessage(verdict.reason, request.language),
        refused: true,
        refusalReason: verdict.reason,
        groundedIn: [],
        provider: this.name,
      };
    }
    return {
      text,
      refused: false,
      refusalReason: null,
      groundedIn: ['summary', 'commonUses'],
      provider: this.name,
    };
  }

  async answer(request: AnswerRequest): Promise<AiAnswer> {
    const pre = screenQuestion(request.question);
    if (!pre.allowed) {
      // Never sent to the model at all.
      return {
        text: refusalMessage(pre.reason, request.language),
        refused: true,
        refusalReason: pre.reason,
        groundedIn: [],
        provider: this.name,
      };
    }

    const text = await this.complete(
      buildAnswerPrompt(request.medicine, request.question, request.language),
      700,
    );

    const post = screenAnswer(text);
    if (!post.allowed) {
      logger.warn('AI answer blocked by output screen', { provider: this.name });
      return {
        text: refusalMessage(post.reason, request.language),
        refused: true,
        refusalReason: post.reason,
        groundedIn: [],
        provider: this.name,
      };
    }

    return {
      text: text || noVerifiedInfoMessage(request.language),
      refused: false,
      refusalReason: null,
      groundedIn: ['verified record'],
      provider: this.name,
    };
  }

  async translate(request: TranslateRequest): Promise<MedicineContent> {
    const raw = await this.complete(
      buildTranslatePrompt(request.content, request.targetLanguage),
      2000,
    );

    let parsed: unknown;
    try {
      // Tolerate a fenced block around the JSON.
      const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      parsed = JSON.parse(json);
    } catch (e) {
      throw new AppError(ERROR_CODES.AI_FAILED, {
        cause: e,
        logContext: { provider: this.name, reason: 'translation was not valid JSON' },
      });
    }

    const result = parsed as Partial<MedicineContent>;
    const source = request.content;

    // Structural guard: a translation that drops or invents list items has
    // changed the medical content, so reject it rather than store it.
    const sameLength = (a: unknown, b: string[]) => Array.isArray(a) && a.length === b.length;
    if (
      !sameLength(result.commonUses, source.commonUses) ||
      !sameLength(result.commonSideEffects, source.commonSideEffects) ||
      !sameLength(result.importantWarnings, source.importantWarnings) ||
      !sameLength(result.cautionGroups, source.cautionGroups)
    ) {
      throw new AppError(ERROR_CODES.AI_FAILED, {
        logContext: { provider: this.name, reason: 'translation changed the number of items' },
      });
    }

    return {
      summary: typeof result.summary === 'string' ? result.summary : source.summary,
      commonUses: result.commonUses as string[],
      mechanismSummary:
        typeof result.mechanismSummary === 'string' ? result.mechanismSummary : source.mechanismSummary,
      commonSideEffects: result.commonSideEffects as string[],
      importantWarnings: result.importantWarnings as string[],
      cautionGroups: result.cautionGroups as string[],
      storageInformation:
        typeof result.storageInformation === 'string'
          ? result.storageInformation
          : source.storageInformation,
    };
  }
}
