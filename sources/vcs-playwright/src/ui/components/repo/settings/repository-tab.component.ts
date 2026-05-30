import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import UploadAvatarForm from '@vcs-pw/ui/components/upload-avatar-form.components';

export default class RepositoryTab extends Element {
  readonly uploadAvatarForm: UploadAvatarForm;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Вкладка "Репозиторий"',
        locator: base.locator('.user-main-content'),
      });
    } else {
      super(base);
    }

    this.uploadAvatarForm = new UploadAvatarForm({
      name: 'Секция "Аватар"',
      locator: this.raw.locator(
        "//*[normalize-space(text())='Основные параметры']/following-sibling::div[1]//form[contains(@action,'avatar')]",
      ),
    });
  }
}
