import { Page } from '@playwright/test';

import BasePage from '@vcs-pw/ui/pages/base.page';

export default class DashboardPage extends BasePage {
  constructor(readonly page: Page) {
    super(page, 'Дашборд', page.locator('.page-content.dashboard'));
  }
}
