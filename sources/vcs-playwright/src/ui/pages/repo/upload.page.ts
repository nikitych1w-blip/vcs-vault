import { Page } from '@playwright/test';

import CommitForm from '@vcs-pw/ui/components/repo/commit-form.component';
import UploadDropzone from '@vcs-pw/ui/components/repo/upload-dropzone.component';
import Element from '@vcs-pw/ui/components/element.component';

import BasePage from '@vcs-pw/ui/pages/base.page';

export default class RepoUploadFilePage extends BasePage {
  readonly uploadZone: UploadDropzone;
  readonly commitForm: CommitForm;
  readonly breadcrumb: Element;
  readonly breadcrumbCancel: Element;

  constructor(readonly page: Page) {
    super(page, 'Репозиторий. Загрузка файла', page.locator('.page-content.repository.upload'));

    this.uploadZone = new UploadDropzone(this.content);
    this.commitForm = new CommitForm(this.content);
    this.breadcrumb = new Element({ name: 'Хлебные крошки', locator: this.content.locator('.breadcrumb') });
    this.breadcrumbCancel = this.breadcrumb.child('Отменить', (base) => base.getByRole('link', { name: 'Отменить' }));
  }
}
