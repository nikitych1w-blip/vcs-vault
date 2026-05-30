import { Page } from '@playwright/test';

import BasePage from '@vcs-pw/ui/pages/base.page';

export default class RepoCodeBranchQuickStartPage extends BasePage {
  constructor(readonly page: Page) {
    super(
      page,
      'Репозиторий. Вкладка "Код". Ветка. Краткое руководство',
      page.locator('.page-content.repository.quickstart'),
    );
  }
}
