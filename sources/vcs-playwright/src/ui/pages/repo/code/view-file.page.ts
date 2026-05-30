import { Page } from '@playwright/test';
import Element from '@vcs-pw/ui/components/element.component';

import BasePage from '@vcs-pw/ui/pages/base.page';

export default class RepoViewFilePage extends BasePage {
  readonly action: Element;
  private readonly openRawAction: Element;

  constructor(readonly page: Page) {
    super(page, 'Репозиторий. Вкладка "Код". Просмотр файла', page.locator('.page-content.repository.file.list'));

    this.action = new Element({
      name: 'Действие',
      locator: this.content.locator('.file-body .file-actions a'),
    });
    this.openRawAction = this.action.getByText('Исходник');
  }

  async openRaw() {
    const [newPage] = await Promise.all([this.page.context().waitForEvent('page'), this.openRawAction.click()]);
    return newPage;
  }
}
