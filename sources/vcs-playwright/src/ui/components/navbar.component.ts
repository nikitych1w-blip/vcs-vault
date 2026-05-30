import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';

export default class NavBar extends Element {
  readonly notifications: Element;
  readonly settings: Element;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Панель навигации',
        locator: base.locator('#navbar'),
      });
    } else {
      super(base);
    }

    this.notifications = this.child('Уведомления', (base) => base.getByRole('link', { name: 'Уведомления' }));
    this.settings = this.child('Профиль и настройки', (base) =>
      base.getByRole('menu', { name: 'Профиль и настройки...' }),
    );
  }
}
