import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';

export default class SideMenuItem extends Element {
  readonly logo: Element;
  readonly title: Element;
  readonly chip: Element;
  readonly toggle: Element;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Боковое меню. Пункт меню',
        locator: base.locator('[class^=menuItem]'),
      });
    } else {
      super(base);
    }

    this.logo = this.child('Логотип', '[class^=icon]');
    this.title = this.child('Название', '[class^=barMenuTooltipText]');
    this.chip = this.child('Фишка', '[class^=chip]');
    this.toggle = this.child('Переключатель раскрытия', '[class^=barMenuItemIconDown]');
  }
}
