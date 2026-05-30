/**
 * Форматирует строку-шаблон, заменяя плейсхолдеры вида `{ключ}` на соответствующие значения из контекста.
 *
 * @param {string} locator - Строка-шаблон, содержащая плейсхолдеры в фигурных скобках, например: `div[id="{id}"]`.
 * @param {Record<string, string | boolean | number>} context - Объект, содержащий значения для подстановки в шаблон.
 *                        Ключи объекта должны соответствовать именам в плейсхолдерах (без фигурных скобок).
 *                        Поддерживаются значения типов: строка, число, булево.
 *
 * @returns {string} Отформатированная строка, в которой все найденные плейсхолдеры заменены на соответствующие значения.
 *                   Если значение для плейсхолдера отсутствует (`undefined` или `null`), оставляется исходный плейсхолдер.
 *
 * @example
 * formatString('div[data-id="{id}"]', { id: 123 });
 * // Результат: 'div[data-id="123"]'
 *
 * @example
 * formatString('div[visible="{show}"]', { show: true, id: 456 });
 * // Результат: 'div[visible="true"]'
 *
 * @example
 * formatString('div[value="{missing}"]', { present: 'yes' });
 * // Результат: 'div[value="{missing}"]' (остаётся без изменений, так как `missing` нет в контексте)
 */
export function formatString(locator: string, context: Record<string, string | boolean | number>): string {
  return locator.replace(/\{([^}]+)\}/g, (_, key) => {
    const value = context[key];
    return value !== undefined && value !== null ? value.toString() : _;
  });
}

export function formatTextOrRegex(value: string | RegExp): string {
  return value instanceof RegExp ? `/${value.source}/${value.flags}` : `"${value}"`;
}

export function getByteLength(input: string | Buffer): number {
  if (Buffer.isBuffer(input)) {
    return input.length;
  } else {
    return Buffer.byteLength(input);
  }
}
