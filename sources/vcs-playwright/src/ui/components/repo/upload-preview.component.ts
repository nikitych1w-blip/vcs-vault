import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';

export const StatusClass = {
  SUCCESS: 'dz-success',
  ERROR: 'dz-error',
  COMPLETE: 'dz-complete',
};

export default class UploadPreview extends Element {
  readonly remove: Element;
  readonly errorMark: Element;
  readonly errorMessage: Element;
  readonly progress: Element;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Предосмотр файла',
        locator: base.locator('.dz-preview'),
      });
    } else {
      super(base);
    }

    this.remove = this.child('Удалить файл', '.dz-remove');
    this.errorMark = this.child('Иконка ошибки', '.dz-error-mark');
    this.errorMessage = this.child('Текст ошибки', '.dz-error-message');
    this.progress = this.child('Прогресс', '.dz-progress');
  }
}
