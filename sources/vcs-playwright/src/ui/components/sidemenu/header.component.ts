import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';

export default class SideMenuHeader extends Element {
  readonly logo: Element;
  readonly toggle: Element;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Боковое меню. Заголовок',
        locator: base.locator('[class^=menuHeader]'),
      });
    } else {
      super(base);
    }

    this.logo = this.child('Логотип', '[aria-label=Логотип]');
    this.toggle = this.child('Переключатель видимости', '[class^=resetButton]');
  }
}
