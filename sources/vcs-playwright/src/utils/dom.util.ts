import { HTMLElement } from 'node-html-parser';

export function safeFind(root: HTMLElement | null, selector: string, description: string): HTMLElement {
  if (!root) {
    throw new Error(`Контейнер для поиска элемента "${description}" отсутствует`);
  }

  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`${description} не найден на странице`);
  }
  return element;
}

export function safeAttr(element: HTMLElement, attr: string, description: string): string {
  const value = element.getAttribute(attr);
  if (!value) {
    throw new Error(`Атрибут "${attr}" у элемента "${description}" отсутствует`);
  }
  return value;
}

export function safeMatch(input: string, regex: RegExp, description: string): string {
  const match = input.match(regex);
  if (!match) {
    throw new Error(`Не удалось извлечь данные: ${description}`);
  }
  return match[1];
}
