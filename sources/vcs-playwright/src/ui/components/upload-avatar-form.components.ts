import { Response } from '@playwright/test';

import { config } from '@vcs-pw/config';
import { ImageMeta } from '@vcs-pw/services/image.service';
import { step } from '@vcs-pw/test';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';

const UPLOAD_AVATAR_PATH = '/settings/avatar';
const DELETE_AVATAR_PATH = '/settings/avatar/delete';
const toAvatarRoutePredicate = (path: string) => (resp: Response) =>
  resp.url().includes(path) && resp.status() === 303 && resp.request().method() === 'POST';

export default class UploadAvatarForm extends Element {
  readonly uploadField: Element;
  readonly delete: Element;
  readonly submit: Element;

  constructor(base: ElementOptions) {
    super(base);

    this.uploadField = this.child('Поле загрузки', 'input[name=avatar]');
    this.delete = this.child('Удалить', '[data-request-url$=delete]');
    this.submit = this.child('Обновить', (base) => base.getByText('Обновить аватар'));
  }

  async uploadAvatar(image: Buffer, imageMeta: ImageMeta) {
    return step('Ожидание загрузки аватара', async () => {
      const responsePromise = this.raw
        .page()
        .waitForResponse(toAvatarRoutePredicate(UPLOAD_AVATAR_PATH), { timeout: config.ui.responseTimeout });
      await this.uploadField.setInputFiles({
        name: `avatar.${imageMeta.extension}`,
        mimeType: imageMeta.mimeType,
        buffer: image,
      });
      await this.submit.click();
      await responsePromise;
    });
  }

  async deleteAvatar() {
    return step('Ожидание удаления аватара', async () => {
      const responsePromise = this.raw
        .page()
        .waitForResponse(toAvatarRoutePredicate(DELETE_AVATAR_PATH), { timeout: config.ui.responseTimeout });
      await this.delete.hover();
      await this.delete.click();
      await responsePromise;
    });
  }
}
