import { Page } from '@playwright/test';
import Element from '@vcs-pw/ui/components/element.component';

import BasePage from '@vcs-pw/ui/pages/base.page';

export default class RepoCodeBranchPage extends BasePage {
  readonly fileName: Element;

  constructor(readonly page: Page) {
    super(page, 'Репозиторий. Вкладка "Код". Ветка', page.locator('.page-content.repository.file.list'));

    this.fileName = new Element({
      name: 'Имя файла',
      locator: this.content.locator('#repo-files-table tbody tr td.name a'),
    });
  }
}
