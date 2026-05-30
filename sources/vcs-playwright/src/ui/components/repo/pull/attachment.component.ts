import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';

export default class Attachment extends Element {
  readonly download: Element;
  readonly title: Element;
  readonly size: Element;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Вложение',
        locator: base.locator('.dropzone-attachments > .gt-df'),
      });
    } else {
      super(base);
    }

    this.download = this.child('Скачать', '.attachment-icon-link');
    this.title = this.child('Название', '.attachment-name-link');
    this.size = this.child('Размер', '.right');
  }
}
