import { ElementHandle, Expect, Locator, expect } from '@playwright/test';

import { step } from '@vcs-pw/test';
import { TimeoutOptions } from '@vcs-pw/ui';
import { formatTextOrRegex } from '@vcs-pw/utils/string.util';

type ExpectCall = Expect['soft'];

export interface ElementOptions {
  name: string;
  locator: Locator;
}

/**
 * Легкая обертка над Locator и LocatorAssertions для уменьшения аффекта на API PW: для фильтрации надо использовать chaining/filtering API.
 * Содержит метаинформацию по части имени для кастомизируемых шагов в allure
 */
export default class Element {
  readonly name: string;
  readonly raw: Locator;
  readonly expect: ElementExpect;
  readonly softExpect: ElementExpect;

  constructor({ name, locator }: ElementOptions) {
    this.name = name;
    this.raw = locator;
    this.expect = new ElementExpect(this, expect);
    this.softExpect = new ElementExpect(this, expect.soft);
  }

  /**
   * Создаёт дочерний элемент на основе текущего (родительского) локатора.
   *
   * @param nameSuffix - Строка, описывающая дочерний элемент. Используется для формирования понятного имени цепочки элементов (для логирования, отладки и т.п.).
   * @param locatorOrFactory - Может быть одним из трёх типов:
   *   - `string`: CSS- или XPath-селектор, применяемый к текущему элементу.
   *   - `Locator`: Готовый локатор Playwright, который будет использован как есть.
   *   - `(base: Locator) => Locator`: Функция-фабрика, которая принимает текущий локатор (`this.raw`) и возвращает новый локатор.
   *
   * @returns Новый экземпляр класса `Element`, представляющий дочерний элемент с обновлённым именем и локатором.
   *
   * @example
   * // Использование строки-селектора
   * element.child('Button', 'button.submit');
   *
   * @example
   * // Использование функции-фабрики
   * element.child('Input', base => base.locator('input').first());
   *
   * @example
   * // Использование готового локатора
   * const locator = page.locator('.item');
   * element.child('Item', locator);
   */
  child(nameSuffix: string, locatorOrFactory: ((base: Locator) => Locator) | Locator | string): Element {
    let locator;
    if (typeof locatorOrFactory === 'function') {
      locator = locatorOrFactory(this.raw);
    } else if (typeof locatorOrFactory === 'string') {
      locator = this.raw.locator(locatorOrFactory);
    } else {
      locator = locatorOrFactory;
    }
    return new Element({
      name: `${this.name} > ${nameSuffix}`,
      locator,
    });
  }

  first(): this {
    const constructor = this.constructor as new (options: ElementOptions) => this;
    return new constructor({
      name: `${this.name} [0]`,
      locator: this.raw.first(),
    });
  }

  last(): this {
    const constructor = this.constructor as new (options: ElementOptions) => this;
    return new constructor({
      name: `${this.name} [-1]`,
      locator: this.raw.last(),
    });
  }

  nth(index: number): this {
    const constructor = this.constructor as new (options: ElementOptions) => this;
    return new constructor({
      name: `${this.name} [${index}]`,
      locator: this.raw.nth(index),
    });
  }

  filter(options?: Parameters<Locator['filter']>[0]): this {
    const constructor = this.constructor as new (options: ElementOptions) => this;
    return new constructor({
      name: `${this.name} filtered`,
      locator: this.raw.filter(options),
    });
  }

  and(element: Element): Element {
    return new Element({
      name: `(${this.name}) && (${element.name})`,
      locator: this.raw.and(element.raw),
    });
  }

  or(element: Element): Element {
    return new Element({
      name: `(${this.name}) || (${element.name})`,
      locator: this.raw.or(element.raw),
    });
  }

  // --- Поиск дочерних элементов ---
  locator(selector: string, options?: Parameters<Locator['locator']>[1]): Element {
    return this.child(selector, (base) => base.locator(selector, options));
  }

  getByRole(role: Parameters<Locator['getByRole']>[0], options?: Parameters<Locator['getByRole']>[1]): Element {
    return this.child(`role=${role}`, (base) => base.getByRole(role, options));
  }

  getByTestId(testId: string | RegExp): Element {
    const testIdStr = formatTextOrRegex(testId);
    return this.child(`test-id=${testIdStr}`, (base) => base.getByTestId(testId));
  }

  // Обобщенный метод для getBy* с текстовыми параметрами
  private getByTextLike<
    M extends keyof Pick<Locator, 'getByText' | 'getByLabel' | 'getByPlaceholder' | 'getByAltText' | 'getByTitle'>,
  >(prefix: string, text: string | RegExp, method: M, options?: Parameters<Locator[M]>[1]): Element {
    const textStr = formatTextOrRegex(text);
    const exact = options?.exact ? ' exact' : '';
    const description = `${prefix}=${textStr}${exact}`;

    return this.child(description, (base) => base[method](text, options));
  }

  getByText(text: string | RegExp, options?: Parameters<Locator['getByText']>[1]): Element {
    return this.getByTextLike('text', text, 'getByText', options);
  }

  getByLabel(label: string | RegExp, options?: Parameters<Locator['getByLabel']>[1]): Element {
    return this.getByTextLike('label', label, 'getByLabel', options);
  }

  getByPlaceholder(placeholder: string | RegExp, options?: Parameters<Locator['getByPlaceholder']>[1]): Element {
    return this.getByTextLike('placeholder', placeholder, 'getByPlaceholder', options);
  }

  getByAltText(alt: string | RegExp, options?: Parameters<Locator['getByAltText']>[1]): Element {
    return this.getByTextLike('alt', alt, 'getByAltText', options);
  }

  getByTitle(title: string | RegExp, options?: Parameters<Locator['getByTitle']>[1]): Element {
    return this.getByTextLike('title', title, 'getByTitle', options);
  }

  // --- Основные действия (остаются без изменений) ---

  async click(options?: Parameters<Locator['click']>[0]): Promise<void> {
    return step(`Клик по "${this.name}"`, () => this.raw.click(options));
  }

  async fill(text: string, options?: Parameters<Locator['fill']>[1]): Promise<void> {
    return step(`Ввод текста "${text}" в "${this.name}"`, () => this.raw.fill(text, options));
  }

  async getAttribute(name: string, options?: Parameters<Locator['getAttribute']>[1]): Promise<string | null> {
    return step(`Получение атрибута "${name}" у "${this.name}"`, () => this.raw.getAttribute(name, options));
  }

  async getText(options?: Parameters<Locator['textContent']>[0]): Promise<string | null> {
    return step(`Получение текста из "${this.name}"`, () => this.raw.textContent(options));
  }

  async getInnerHtml(options?: Parameters<Locator['innerHTML']>[0]): Promise<string> {
    return step(`Получение innerHTML из "${this.name}"`, () => this.raw.innerHTML(options));
  }

  async getInputValue(options?: Parameters<Locator['inputValue']>[0]): Promise<string> {
    return step(`Получение значения из "${this.name}"`, () => this.raw.inputValue(options));
  }

  async isVisible(options?: Parameters<Locator['isVisible']>[0]): Promise<boolean> {
    return step(`Проверка видимости "${this.name}"`, () => this.raw.isVisible(options));
  }

  async isDisabled(options?: Parameters<Locator['isDisabled']>[0]): Promise<boolean> {
    return step(`Проверка состояния disabled у "${this.name}"`, () => this.raw.isDisabled(options));
  }

  async isEnabled(options?: Parameters<Locator['isEnabled']>[0]): Promise<boolean> {
    return step(`Проверка состояния enabled у "${this.name}"`, () => this.raw.isEnabled(options));
  }

  async isChecked(options?: Parameters<Locator['isChecked']>[0]): Promise<boolean> {
    return step(`Проверка состояния checked у "${this.name}"`, () => this.raw.isChecked(options));
  }

  async hover(options?: Parameters<Locator['hover']>[0]): Promise<void> {
    return step(`Наведение мыши на "${this.name}"`, () => this.raw.hover(options));
  }

  async scrollIntoView(options?: Parameters<Locator['scrollIntoViewIfNeeded']>[0]): Promise<void> {
    return step(`Прокрутка к "${this.name}"`, () => this.raw.scrollIntoViewIfNeeded(options));
  }

  async dblClick(options?: Parameters<Locator['dblclick']>[0]): Promise<void> {
    return step(`Двойной клик по "${this.name}"`, () => this.raw.dblclick(options));
  }

  async rightClick(options?: Parameters<Locator['click']>[0]): Promise<void> {
    return step(`Правый клик по "${this.name}"`, () => this.raw.click({ ...options, button: 'right' }));
  }

  async boundingBox(
    options?: Parameters<Locator['boundingBox']>[0],
  ): Promise<{ x: number; y: number; width: number; height: number } | null> {
    return step(`Получение размеров "${this.name}"`, () => this.raw.boundingBox(options));
  }

  async clear(options?: Parameters<Locator['clear']>[0]): Promise<void> {
    return step(`Очистка "${this.name}"`, () => this.raw.clear(options));
  }

  async selectOption(
    values:
      | string
      | ElementHandle<Node>
      | readonly string[]
      | {
          value?: string;
          label?: string;
          index?: number;
        }
      | readonly ElementHandle<Node>[]
      | readonly {
          value?: string;
          label?: string;
          index?: number;
        }[],
    options?: Parameters<Locator['selectOption']>[1],
  ): Promise<string[]> {
    return step(`Выбор опции "${values}" в "${this.name}"`, () => this.raw.selectOption(values, options));
  }

  async press(key: string, options?: Parameters<Locator['press']>[1]): Promise<void> {
    return step(`Нажатие клавиши "${key}" на "${this.name}"`, () => this.raw.press(key, options));
  }

  async evaluate(
    expression: (element: HTMLElement) => any,
    options?: Parameters<Locator['evaluate']>[1],
  ): Promise<any> {
    return step(`Выполнение JavaScript на "${this.name}"`, () => this.raw.evaluate(expression, options));
  }

  async evaluateAll<T>(expression: (elements: HTMLElement[]) => T): Promise<T> {
    return step(`Выполнение JavaScript на всех "${this.name}"`, () => this.raw.evaluateAll(expression));
  }

  async tap(options?: Parameters<Locator['tap']>[0]): Promise<void> {
    return step(`Тап по "${this.name}"`, () => this.raw.tap(options));
  }

  async dragTo(target: Locator, options?: Parameters<Locator['dragTo']>[1]): Promise<void> {
    return step(`Перетаскивание "${this.name}" в целевой элемент`, () => this.raw.dragTo(target, options));
  }

  async setChecked(checked: boolean, options?: Parameters<Locator['setChecked']>[1]): Promise<void> {
    return step(`Установка состояния checked "${checked}" для "${this.name}"`, () =>
      this.raw.setChecked(checked, options),
    );
  }

  async setInputFiles(
    files:
      | string
      | readonly string[]
      | {
          name: string;
          mimeType: string;
          buffer: Buffer<ArrayBufferLike>;
        }
      | readonly {
          name: string;
          mimeType: string;
          buffer: Buffer;
        }[],
    options?: Parameters<Locator['setInputFiles']>[1],
  ): Promise<void> {
    return step(`Установка файлов в "${this.name}"`, () => this.raw.setInputFiles(files, options));
  }

  async selectText(options?: Parameters<Locator['selectText']>[0]): Promise<void> {
    return step(`Выделение текста в "${this.name}"`, () => this.raw.selectText(options));
  }

  async allInnerTexts(): Promise<string[]> {
    return this.raw.allInnerTexts();
  }

  async allTextContents(): Promise<string[]> {
    return this.raw.allTextContents();
  }
}

class ElementExpect {
  constructor(
    private readonly element: Element,
    private readonly expect: ExpectCall,
  ) {}

  // --- Состояния ---
  async toBeAttached(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" присутствует в DOM`, () =>
      this.expect(this.element.raw).toBeAttached(options),
    );
  }

  async notToBeAttached(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" отсутствует в DOM`, () =>
      this.expect(this.element.raw).not.toBeAttached(options),
    );
  }

  async toBeEditable(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" доступен для редактирования`, () =>
      this.expect(this.element.raw).toBeEditable(options),
    );
  }

  async notToBeEditable(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не доступен для редактирования`, () =>
      this.expect(this.element.raw).not.toBeEditable(options),
    );
  }

  async toBeEmpty(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не содержит текст`, () =>
      this.expect(this.element.raw).toBeEmpty(options),
    );
  }

  async toNotBeEmpty(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" содержит текст`, () =>
      this.expect(this.element.raw).not.toBeEmpty(options),
    );
  }

  async toBeFocused(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" находится в фокусе`, () =>
      this.expect(this.element.raw).toBeFocused(options),
    );
  }

  async notToBeFocused(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не находится в фокусе`, () =>
      this.expect(this.element.raw).not.toBeFocused(options),
    );
  }

  async toBeInViewport(
    options?: {
      ratio?: number | undefined;
    } & TimeoutOptions,
  ): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" находится в области просмотра`, () =>
      this.expect(this.element.raw).toBeInViewport(options),
    );
  }

  async toBeVisible(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" видим`, () => this.expect(this.element.raw).toBeVisible(options));
  }

  async toBeHidden(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" скрыт`, () => this.expect(this.element.raw).toBeHidden(options));
  }

  async toBeEnabled(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" активен`, () =>
      this.expect(this.element.raw).toBeEnabled(options),
    );
  }

  async toBeDisabled(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не активен`, () =>
      this.expect(this.element.raw).toBeDisabled(options),
    );
  }

  async toBeChecked(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" выбран`, () =>
      this.expect(this.element.raw).toBeChecked(options),
    );
  }

  async notToBeChecked(options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не выбран`, () =>
      this.expect(this.element.raw).not.toBeChecked(options),
    );
  }

  // --- Атрибуты ---

  async toHaveText(
    expected: string | RegExp | (string | RegExp)[],
    options?: {
      ignoreCase?: boolean;
      useInnerText?: boolean;
    } & TimeoutOptions,
  ): Promise<void> {
    return step(`Ожидание, что текст "${this.element.name}" равен "${expected}"`, () =>
      this.expect(this.element.raw).toHaveText(expected, options),
    );
  }

  async notToHaveText(
    expected: string | RegExp | (string | RegExp)[],
    options?: {
      ignoreCase?: boolean;
      useInnerText?: boolean;
    } & TimeoutOptions,
  ): Promise<void> {
    return step(`Ожидание, что текст "${this.element.name}" не равен "${expected}"`, () =>
      this.expect(this.element.raw).not.toHaveText(expected, options),
    );
  }

  async toHaveValue(expected: string | RegExp, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" имеет значение "${expected}"`, () =>
      this.expect(this.element.raw).toHaveValue(expected, options),
    );
  }

  async notToHaveValue(expected: string | RegExp, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не имеет значение "${expected}"`, () =>
      this.expect(this.element.raw).not.toHaveValue(expected, options),
    );
  }

  async toHaveAttribute(name: string, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" имеет атрибут "${name}"`, () =>
      this.expect(this.element.raw).toHaveAttribute(name, options),
    );
  }

  async notToHaveAttribute(name: string, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не имеет атрибут "${name}"`, () =>
      this.expect(this.element.raw).not.toHaveAttribute(name, options),
    );
  }

  async toHaveAttributeValue(
    name: string,
    expected: string | RegExp,
    options?: {
      ignoreCase?: boolean;
    } & TimeoutOptions,
  ): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" имеет атрибут "${name}" со значением "${expected}"`, () =>
      this.expect(this.element.raw).toHaveAttribute(name, expected, options),
    );
  }

  async notToHaveAttributeValue(
    name: string,
    expected: string | RegExp,
    options?: {
      ignoreCase?: boolean;
    } & TimeoutOptions,
  ): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не имеет атрибут "${name}" со значением "${expected}"`, () =>
      this.expect(this.element.raw).not.toHaveAttribute(name, expected, options),
    );
  }

  async toHaveCount(count: number, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" имеет ${count} элементов`, () =>
      this.expect(this.element.raw).toHaveCount(count, options),
    );
  }

  async notToHaveCount(count: number, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не имеет ${count} элементов`, () =>
      this.expect(this.element.raw).not.toHaveCount(count, options),
    );
  }

  async toContainClass(className: string | string[], options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" содержит класс "${className}"`, () =>
      this.expect(this.element.raw).toContainClass(className, options),
    );
  }

  async notToContainClass(className: string | string[], options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не содержит класс "${className}"`, () =>
      this.expect(this.element.raw).not.toContainClass(className, options),
    );
  }

  async toHaveClass(className: string | RegExp, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" имеет класс "${className}"`, () =>
      this.expect(this.element.raw).toHaveClass(className, options),
    );
  }

  async notToHaveClass(className: string | RegExp, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не имеет класс "${className}"`, () =>
      this.expect(this.element.raw).not.toHaveClass(className, options),
    );
  }

  async toHaveCss(name: string, expected: string | RegExp, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" имеет CSS стиль "${name}" со значением "${expected}"`, () =>
      this.expect(this.element.raw).toHaveCSS(name, expected, options),
    );
  }

  async notToHaveCss(name: string, expected: string | RegExp, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не имеет CSS стиль "${name}" со значением "${expected}"`, () =>
      this.expect(this.element.raw).not.toHaveCSS(name, expected, options),
    );
  }

  async toContainText(
    expected: string | RegExp,
    options?: {
      ignoreCase?: boolean | undefined;
      useInnerText?: boolean | undefined;
    } & TimeoutOptions,
  ): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" содержит текст "${expected}"`, () =>
      this.expect(this.element.raw).toContainText(expected, options),
    );
  }

  async notToContainText(
    expected: string | RegExp,
    options?: {
      ignoreCase?: boolean | undefined;
      useInnerText?: boolean | undefined;
    } & TimeoutOptions,
  ): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" не содержит текст "${expected}"`, () =>
      this.expect(this.element.raw).not.toContainText(expected, options),
    );
  }

  async toHaveTextInAnyElement(expected: string | RegExp, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что хотя бы один элемент "${this.element.name}" содержит текст "${expected}"`, () =>
      this.expect(this.element.raw.filter({ hasText: expected }).first()).toBeVisible(options),
    );
  }

  async toHaveLink(expected: string | RegExp, options?: TimeoutOptions): Promise<Element> {
    return step(`Ожидание, что элемент "${this.element.name}" содержит ссылку с текстом "${expected}"`, async () => {
      const link = this.element.raw.locator('a').filter({ hasText: expected }).first();
      await this.expect(link).toBeVisible(options);
      return this.element.child('Ссылка', link);
    });
  }

  async toHaveScreenshot(
    name: string | string[],
    options?: {
      animations?: 'disabled' | 'allow' | undefined;
      caret?: 'hide' | 'initial' | undefined;
      mask?: Locator[] | undefined;
      maskColor?: string;
      maxDiffPixelRatio?: number;
      maxDiffPixels?: number;
      omitBackground?: boolean;
      scale?: 'css' | 'device';
      stylePath?: string | string[];
      threshold?: number;
    } & TimeoutOptions,
  ): Promise<void> {
    return step(`Ожидание, что "${this.element.name}" соответствует скриншоту "${name}"`, () =>
      this.expect(this.element.raw).toHaveScreenshot(name, options),
    );
  }
}
