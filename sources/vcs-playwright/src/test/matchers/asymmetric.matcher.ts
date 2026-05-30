import { Expect } from '@playwright/test';
import _ from 'lodash';

/**
 * Сейчас PW напрямую неподдерживает расширение асимметричных матчеров
 * Делаем через миксины
 */
type AsymmetricMatcher = Record<string, any>;

const NUMERIC_STRING_REGEX = /^\d+$/;
const ISO_STRING_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const ISO_MILLIS_NO_TZ_STRING_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ExtendedAsymmetricMatchers<T> {
  stringIso(this: T): AsymmetricMatcher;
  stringIsoCloseTo(this: T, offsetSeconds?: number): AsymmetricMatcher;
  stringIsoMillisNoTz(this: T): AsymmetricMatcher;
  uuid(this: T): AsymmetricMatcher;
  numericString(this: T): AsymmetricMatcher;
  hasLength(this: T, count: number): AsymmetricMatcher;
  stringConsistsOf(this: T, values: any[], delimiter: string): AsymmetricMatcher;
  arrayEqualsInAnyOrder(this: T, values: (number | string | undefined)[]): AsymmetricMatcher;
  timestampCloseTo(this: T, offsetSeconds?: number): AsymmetricMatcher;
}

class ToConsistOf {
  constructor(
    private readonly values: (number | string | undefined)[],
    private readonly delimiter: string,
  ) {}

  asymmetricMatch(value: any | undefined) {
    const stringValue = value ? value.toString() : '';
    const stringValues = stringValue.split(this.delimiter);
    return _.isEqual(_.countBy(this.values), _.countBy(stringValues));
  }

  toString() {
    return `array to consist of ${this.values}`;
  }

  toAsymmetricMatcher() {
    return this.toString();
  }
}

class ToEqualInAnyOrder {
  constructor(private readonly expected: any[]) {}

  asymmetricMatch(actual: any[]) {
    return _.isEqual(_.countBy(this.expected), _.countBy(actual));
  }

  toString() {
    return `array to equal in any order ${this.expected}`;
  }

  toAsymmetricMatcher() {
    return this.toString();
  }
}

class ToBeWithinRange {
  private readonly min: number;
  private readonly max: number;

  constructor(now: number, delta: number) {
    this.min = now - delta;
    this.max = now + delta;
  }

  asymmetricMatch(value: string | number) {
    value = Number(value);
    return value >= this.min && value <= this.max;
  }

  toString() {
    return `value to be within ${this.min} and ${this.max}`;
  }

  toAsymmetricMatcher() {
    return this.toString();
  }
}

class ToHaveLength {
  constructor(private readonly count: number) {}

  asymmetricMatch(value: any[] | string) {
    return !!value && value.length == this.count;
  }

  toString() {
    return `array to have length ${this.count}`;
  }

  toAsymmetricMatcher() {
    return this.toString();
  }
}

class ToBeIsoStringCloseTo {
  private readonly minTimeMs: number;
  private readonly maxTimeMs: number;

  constructor(offsetSeconds: number) {
    const nowMs = Date.now();
    const offsetMs = offsetSeconds * 1000;
    this.minTimeMs = nowMs - offsetMs;
    this.maxTimeMs = nowMs + offsetMs;
  }

  asymmetricMatch(value: any): boolean {
    if (typeof value !== 'string' || !ISO_STRING_REGEX.test(value)) {
      return false;
    }

    // Парсим как ISO (значение в UTC)
    const parsed = new Date(value).getTime();

    // Проверяем, что дата валидна и в диапазоне
    if (isNaN(parsed)) {
      return false;
    }

    return parsed >= this.minTimeMs && parsed <= this.maxTimeMs;
  }

  toString() {
    const min = new Date(this.minTimeMs).toISOString();
    const max = new Date(this.maxTimeMs).toISOString();
    return `ISO timestamp close to now (± ${this.maxTimeMs - Date.now()}ms), range: ${min} ~ ${max}`;
  }

  toAsymmetricMatcher() {
    return this.toString();
  }
}

export function extendAsymmetricMatchers<T extends Expect>(expect: T): T & ExtendedAsymmetricMatchers<T> {
  return Object.assign(expect, {
    stringIso(this: T): AsymmetricMatcher {
      return this.stringMatching(ISO_STRING_REGEX);
    },

    stringIsoCloseTo(this: T, offsetSeconds = 30): AsymmetricMatcher {
      return new ToBeIsoStringCloseTo(offsetSeconds);
    },

    stringIsoMillisNoTz(this: T): AsymmetricMatcher {
      return this.stringMatching(ISO_MILLIS_NO_TZ_STRING_REGEX);
    },

    uuid(this: T): AsymmetricMatcher {
      return this.stringMatching(UUID_REGEX);
    },

    numericString(this: T): AsymmetricMatcher {
      return this.stringMatching(NUMERIC_STRING_REGEX);
    },

    hasLength(this: T, count: number): AsymmetricMatcher {
      return new ToHaveLength(count);
    },

    stringConsistsOf(this: T, values: (number | string | undefined)[], delimiter: string): AsymmetricMatcher {
      return new ToConsistOf(values, delimiter);
    },

    arrayEqualsInAnyOrder(this: T, values: any[]): AsymmetricMatcher {
      return new ToEqualInAnyOrder(values);
    },

    timestampCloseTo(this: T, offsetSeconds = 30): AsymmetricMatcher {
      const now = Math.floor(Date.now() / 1000);
      return new ToBeWithinRange(now, offsetSeconds);
    },
  });
}
