import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';

export default class LinkedTask extends Element {
  readonly code: Element;
  readonly priority: Element;
  readonly status: Element;
  readonly summary: Element;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Задача',
        locator: base.locator('.tt-card'),
      });
    } else {
      super(base);
    }

    this.code = this.child('Код', '.tt-card__name-link');
    this.priority = this.child('Приоритет', '.tt-card__priority');
    this.status = this.child('Статус', '.badge');
    this.summary = this.child('Заголовок', '.tt-card__description');
  }
}
