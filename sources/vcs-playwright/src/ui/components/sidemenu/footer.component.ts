import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import List from '@vcs-pw/ui/components/list.component';

export default class SideMenuFooter extends Element {
  readonly userAvatar: Element;
  readonly userName: Element;
  readonly userEmail: Element;
  readonly menuIcon: Element;
  readonly menuDropdown: List<Element>;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Боковое меню. Подвал',
        locator: base.locator('[data-test-id="open-functional-menu"]'),
      });
    } else {
      super(base);
    }

    this.userAvatar = this.child('Аватар пользователя', '[class^=footerUserAvatar]');
    this.userName = this.child('Имя пользователя', '[class^=footerUserInfoName]');
    this.userEmail = this.child('Почта пользователя', '[class^=footerUserInfoEmail]');
    this.menuIcon = this.child('Три точки', '[class^=footerMenuIcon]');
    // Относится к общему родительскому объекту бокового меню
    this.menuDropdown = new List<Element>({
      locator: this.raw.page().locator('[data-test-id="functional-menu"]'),
      itemLocatorOrFactory: (base) => base.getByRole('menuitem'),
    });
  }
}
