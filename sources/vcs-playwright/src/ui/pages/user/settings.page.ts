import { Page } from '@playwright/test';

import Element from '@vcs-pw/ui/components/element.component';
import List from '@vcs-pw/ui/components/list.component';
import ProfileTab from '@vcs-pw/ui/components/user/settings/profile-tab.component';
import BasePage from '@vcs-pw/ui/pages/base.page';

export default class UserSettingsPage extends BasePage {
  readonly menu: List<Element>;
  readonly profileTab: ProfileTab;

  constructor(readonly page: Page) {
    super(page, 'Пользователь. Настройки', page.locator('.page-content.user.settings'));

    this.menu = new List<Element>({
      locator: this.content.locator('.menu'),
      itemLocatorOrFactory: '.item',
    });
    this.profileTab = new ProfileTab(this.content);
  }
}
