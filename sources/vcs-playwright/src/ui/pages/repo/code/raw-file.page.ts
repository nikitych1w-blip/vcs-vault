import { Page } from '@playwright/test';
import Element from '@vcs-pw/ui/components/element.component';

import BasePage from '@vcs-pw/ui/pages/base.page';

export default class RepoRawFilePage extends BasePage {
  readonly raw: Element;

  constructor(readonly page: Page) {
    super(page, 'Репозиторий. Исходник файла', page.locator('body'));

    this.raw = new Element({ name: 'Содержимое файла', locator: this.content.locator('pre') });
  }
}
