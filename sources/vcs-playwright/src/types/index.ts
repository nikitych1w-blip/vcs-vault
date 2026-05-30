import { z, ZodSafeParseResult } from 'zod';

const DEFAULT_POLL = { timeout: 10000, interval: 1000 } as const;

export const PollSchema = z
  .object({
    timeout: z.number().positive().default(DEFAULT_POLL.timeout),
    interval: z.number().positive().default(DEFAULT_POLL.interval),
  })
  .default(DEFAULT_POLL);

/**
 * Универсальный метод валидации объектов по Zod-схеме
 *
 * @param schema - Zod-схема для валидации
 * @param data - данные для проверки
 * @param raiseIfError - проверять на ошибки
 * @returns Типобезопасный объект
 * @throws Ошибка с описанием, если валидация не прошла
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown, raiseIfError = true): ZodSafeParseResult<T> {
  const result = schema.safeParse(data);

  if (raiseIfError && !result.success) {
    const errorMessages = result.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Ошибка валидации:\n${errorMessages.join('\n')}`);
  }

  return result;
}
