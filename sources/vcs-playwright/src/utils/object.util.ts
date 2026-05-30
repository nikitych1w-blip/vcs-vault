import _ from 'lodash';

type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

type SortDirection = 'asc' | 'desc';
interface SortCriteria {
  field: string;
  direction: SortDirection;
}

export function toPrettyJson(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

export function tryJsonParse(str: string | undefined, fallback: any) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export function removeUndefined(obj: any): any {
  return removeFieldByValue(obj, undefined);
}

export function removeNull(obj: any): any {
  return removeFieldByValue(obj, null);
}

function removeFieldByValue(obj: any, fieldValue: unknown = undefined): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (isAsymmetricMatcher(obj)) return obj;
  if (Array.isArray(obj)) return obj.map((item) => removeFieldByValue(item, fieldValue));
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== fieldValue) {
      cleaned[key] = removeFieldByValue(value, fieldValue);
    }
  }
  return cleaned;
}

function isAsymmetricMatcher(value: any): boolean {
  return typeof value === 'object' && value !== null && typeof value.asymmetricMatch === 'function';
}

export function getRandomElement<T>(array: T[] | readonly T[]): T {
  if (array.length === 0) throw new Error('Массив пуст');
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

/**
 * Извлекает значения указанного поля из каждого объекта в массиве,
 * затем сортирует их в алфавитном порядке (с учётом локали ru/en).
 *
 * @param objects - массив объектов
 * @param fieldName - имя поля, значения которого нужно извлечь (должно быть строковым)
 * @param [reverse=false] - если true, сортирует в обратном порядке (от Я к А)
 * @returns отсортированный массив строковых значений поля
 *
 * @example
 * const items = [
 *   { name: 'Бета' },
 *   { name: 'Гамма' },
 *   { name: 'Альфа' }
 * ];
 * extractFieldAndSort(items, 'name'); // ['Альфа', 'Бета', 'Гамма']
 */
export function extractFieldAndSort<T, K extends StringKeys<T>>(objects: T[], fieldName: K, reverse = false): string[] {
  const fieldValues = objects.map((obj) => obj[fieldName]).map((val) => String(val));

  fieldValues.sort((a, b) => {
    const result = a.localeCompare(b, ['ru', 'en'], {
      numeric: true,
      sensitivity: 'base',
      ignorePunctuation: false,
      caseFirst: 'false' as const,
    });

    return reverse ? -result : result;
  });

  return fieldValues;
}

/**
 * Сортирует массив объектов по указанным полям и направлениям сортировки.
 *
 * @template T - Тип элементов массива (обычно объект).
 *
 * @param objects - Массив объектов для сортировки. Не изменяется.
 * @param fieldOrders - Массив строк, задающих поля и порядок сортировки.
 * Каждая строка может быть в формате:
 *   - 'fieldName' — сортировка по возрастанию (по умолчанию)
 *   - 'fieldName:asc' — сортировка по возрастанию
 *   - 'fieldName:desc' — сортировка по убыванию
 *
 * Поля могут быть вложенными (поддерживается Lodash), например: 'address.city:desc'.
 *
 * @returns Новый отсортированный массив объектов.
 *
 * @example
 * const users = [
 *   { name: 'Alice', age: 30 },
 *   { name: 'Bob', age: 25 },
 *   { name: 'Charlie', age: 30 }
 * ];
 *
 * sortByFields(users, ['age', 'name:desc']);
 * // Сначала по возрасту (asc), затем по имени (desc)
 *
 * @example
 * sortByFields(users, ['name']);
 * // Сортировка по имени по возрастанию (по умолчанию)
 *
 * @example
 * sortByFields(users, ['age:desc']);
 * // Сортировка по возрасту по убыванию
 */
export function sortByFields<T extends object>(objects: T[], criteriaStrings: string[]): T[] {
  const copied = [...objects];
  const sortCriterias = parseSortingParams(criteriaStrings);
  const fields = sortCriterias.map((criteria) => criteria.field);
  const orders = sortCriterias.map((criteria) => criteria.direction);
  return _.orderBy(copied, fields, orders);
}

function parseSortingParams(criteriaStrings: string[]): SortCriteria[] {
  return criteriaStrings.map((item) => {
    const [field, order] = item.split(':');
    return {
      field,
      direction: order?.toLowerCase() === 'desc' ? 'desc' : 'asc',
    };
  });
}

/**
 * Возвращает значение поля из объекта, если объект определён и поле существует.
 * Иначе — вызывает и возвращает результат функции `fallback`.
 *
 * @param obj - объект или undefined/null
 * @param key - ключ поля
 * @param fallback - функция, возвращающая значение по умолчанию (вызывается только при необходимости)
 * @returns значение поля или результат `fallback()`
 *
 * @example
 * const user = { name: 'Alice' };
 * getOr(user, 'name', () => 'Аноним'); // 'Alice'
 * getOr(undefined, 'name', () => 'Аноним'); // 'Аноним'
 * getOr({ age: undefined }, 'age', () => 18); // undefined (поле есть!)
 */
export function getOr<T extends object, K extends keyof T, V>(
  obj: T | null | undefined,
  key: K,
  fallback: () => V,
): T[K] | V {
  return obj != null && key in obj ? obj[key] : fallback();
}

/**
 * Асинхронная задержка выполнения на указанное количество миллисекунд.
 *
 * Полезна для сценариев, где необходимо:
 * - Искусственно разделить время создания сущностей (например, чтобы `created_at` отличалось).
 *
 * @param {number} ms - Количество миллисекунд, на которое нужно приостановить выполнение.
 *                       Должно быть неотрицательным числом.
 * @returns {Promise<void>} Промис, который будет разрешен через указанное количество миллисекунд.
 *
 * @example
 * // Задержка на 1 секунду между созданием комментариев
 * for (const data of commentDataList) {
 *   await commentsApi.createComment(repoOptions, prIndex, data);
 *   await delay(1000);
 * }
 *
 * @note Не используйте слишком длинные задержки в тестах — это замедляет выполнение.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Вызывает указанную функцию `fn` ровно `n` раз,
 * делая задержку между вызовами. Задержка может быть:
 * - константным числом (в мс),
 * - функцией, возвращающей число: (iterationIndex: number) => number.
 *
 * @param fn - функция для вызова
 * @param n - количество вызовов
 * @param delayMs - задержка между вызовами: число или функция (index) => delayInMs
 */
export async function callNTimesWithDelay<T>(
  fn: () => T | Promise<T>,
  n: number,
  delayMs: number | ((iterationIndex: number) => number),
): Promise<(T extends Promise<infer R> ? R : T)[]> {
  const results: any[] = [];

  for (let i = 0; i < n; i++) {
    const result = await fn();
    results.push(result);
    if (i < n - 1) {
      // не ждём после последнего вызова
      const delayValue = typeof delayMs === 'function' ? delayMs(i) : delayMs;
      if (delayValue > 0) {
        await delay(delayValue);
      }
    }
  }

  return results;
}
