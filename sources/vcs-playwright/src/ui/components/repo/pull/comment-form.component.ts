import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import UploadDropzone from '@vcs-pw/ui/components/repo/upload-dropzone.component';

export default class CommentForm extends Element {
  readonly uploadZone: UploadDropzone;
  readonly message: Element;
  readonly submit: Element;
  readonly save: Element;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Форма комментария',
        locator: base.locator('#comment-form'),
      });
    } else {
      super(base);
    }

    this.uploadZone = new UploadDropzone(this.raw);
    this.message = this.child('Сообщение', 'textarea');
    this.submit = this.child('Комментировать', (base) =>
      base.getByRole('button', { name: 'Комментировать', exact: true }),
    );
    this.save = this.child('Сохранить', (base) => base.getByRole('button', { name: 'Сохранить', exact: true }));
  }
}
