import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import UploadAvatarForm from '@vcs-pw/ui/components/upload-avatar-form.components';

export default class ProfileTab extends Element {
  readonly uploadAvatarForm: UploadAvatarForm;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Вкладка "Профиль"',
        locator: base.locator('.user-setting-content'),
      });
    } else {
      super(base);
    }

    this.uploadAvatarForm = new UploadAvatarForm({
      name: 'Секция "Аватар"',
      locator: this.raw.locator(
        "//*[contains(@class,'sc-box_attached')][.//*[normalize-space(text())='Аватар']]//form",
      ),
    });
  }
}
