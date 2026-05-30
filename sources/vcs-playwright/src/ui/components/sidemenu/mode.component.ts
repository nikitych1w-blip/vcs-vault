import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import List from '@vcs-pw/ui/components/list.component';

export default class SideMenuMode extends Element {
  readonly openMenu: Element;
  readonly menuDropdown: List<Element>;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Боковое меню. Переключатель контекста',
        locator: base.locator('[class^=menuMode]'),
      });
    } else {
      super(base);
    }

    this.openMenu = this.child('Открыть меню', '[data-test-id="open-menu-mode-menu"]');
    // Относится к общему родительскому объекту бокового меню
    this.menuDropdown = new List<Element>({
      locator: this.raw.page().locator('[data-test-id="menu-mode-menu"]'),
      itemLocatorOrFactory: (base) => base.getByRole('menuitem'),
    });
  }
}
