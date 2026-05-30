import { Page } from '@playwright/test';

import Element from '@vcs-pw/ui/components/element.component';
import List from '@vcs-pw/ui/components/list.component';
import RepositoryTab from '@vcs-pw/ui/components/repo/settings/repository-tab.component';
import BasePage from '@vcs-pw/ui/pages/base.page';

export default class RepoSettingsPage extends BasePage {
  readonly menu: List<Element>;
  readonly repositoryTab: RepositoryTab;

  constructor(readonly page: Page) {
    super(page, 'Репозиторий. Настройки', page.locator('.page-content.repository.settings'));

    this.menu = new List<Element>({
      locator: this.content.locator('.menu'),
      itemLocatorOrFactory: '.item',
    });

    this.repositoryTab = new RepositoryTab(this.content);
  }
}
