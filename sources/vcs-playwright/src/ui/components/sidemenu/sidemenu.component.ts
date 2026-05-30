import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import SideMenuBody from '@vcs-pw/ui/components/sidemenu/body.component';
import SideMenuFooter from '@vcs-pw/ui/components/sidemenu/footer.component';
import SideMenuHeader from '@vcs-pw/ui/components/sidemenu/header.component';
import SideMenuMode from '@vcs-pw/ui/components/sidemenu/mode.component';

export default class SideMenu extends Element {
  readonly header: SideMenuHeader;
  readonly mode: SideMenuMode;
  readonly body: SideMenuBody;
  readonly footer: SideMenuFooter;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Боковое меню',
        locator: base.locator('side-menu-standalone-v5, #sidemenu'),
      });
    } else {
      super(base);
    }

    this.header = new SideMenuHeader(this.raw);
    this.mode = new SideMenuMode(this.raw);
    this.body = new SideMenuBody(this.raw);
    this.footer = new SideMenuFooter(this.raw);
  }
}
