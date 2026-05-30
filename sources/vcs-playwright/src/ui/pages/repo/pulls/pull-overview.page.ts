import { Page } from '@playwright/test';

import PullMetas from '@vcs-pw/ui/components/repo/pull/meta.component';
import BasePage from '@vcs-pw/ui/pages/base.page';
import Element from '@vcs-pw/ui/components/element.component';
import Timeline from '@vcs-pw/ui/components/repo/pull/timeline.component';

export default class PullOverviewPage extends BasePage {
  readonly title: Element;
  readonly metas: PullMetas;
  readonly timeline: Timeline;

  constructor(readonly page: Page) {
    super(page, 'Запрос на слияние. Обсуждение', page.locator('.page-content.repository.pull.view'));

    this.title = new Element({ name: 'Заголовок', locator: this.content.locator('#issue-title') });
    this.metas = new PullMetas(this.content);
    this.timeline = new Timeline(this.content);
  }
}
