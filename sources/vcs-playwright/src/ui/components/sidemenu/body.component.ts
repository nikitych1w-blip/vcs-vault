import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import List from '@vcs-pw/ui/components/list.component';
import SideMenuItem from '@vcs-pw/ui/components/sidemenu/item.component';

export default class SideMenuBody extends Element {
  readonly rootLevelOptions: List<SideMenuItem>;
  readonly childrenLevelOptions: List<SideMenuItem>;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Боковое меню. Тело',
        locator: base.locator('[class^=menuBody]'),
      });
    } else {
      super(base);
    }

    this.rootLevelOptions = new List<SideMenuItem>({ locator: this.raw, itemClass: SideMenuItem });
    this.childrenLevelOptions = new List<SideMenuItem>({
      locator: this.raw.locator('[class^=barMenuItemChildren]'),
      itemClass: SideMenuItem,
    });
  }
}
