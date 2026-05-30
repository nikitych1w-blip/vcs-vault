import { Locator } from '@playwright/test';

import Element from '@vcs-pw/ui/components/element.component';

interface ListOptionsWithClass<T extends Element> {
  itemClass: new (base: Locator) => T;
  itemLocatorOrFactory?: never;
}

interface ListOptionsWithFactory {
  itemClass?: never;
  itemLocatorOrFactory: ((base: Locator) => Locator) | Locator | string;
}

type ListItemOptions<T extends Element> = ListOptionsWithClass<T> | ListOptionsWithFactory;

type ListOptions<T extends Element> = {
  name?: string;
  locator: Locator;
} & ListItemOptions<T>;

export default class List<T extends Element> extends Element {
  readonly item: T;

  constructor({ name = 'Список', locator, itemClass, itemLocatorOrFactory }: ListOptions<T>) {
    super({
      name,
      locator,
    });
    if (itemClass) {
      this.item = new itemClass(this.raw);
    } else if (itemLocatorOrFactory) {
      this.item = this.child('Элемент', itemLocatorOrFactory) as T;
    } else {
      throw new Error('Не определен способ создания элементов List');
    }
  }
}
