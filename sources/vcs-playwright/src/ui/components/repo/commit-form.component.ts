import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';

export default class CommitForm extends Element {
  readonly avatar: Element;
  readonly summary: Element;
  readonly message: Element;
  readonly signoff: Element;
  readonly submit: Element;
  readonly cancel: Element;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Форма создания коммита',
        locator: base.locator('.commit-form-wrapper'),
      });
    } else {
      super(base);
    }

    this.avatar = this.child('Аватар', '.avatar');
    this.summary = this.child('Заголовок', '[name=commit_summary]');
    this.message = this.child('Описание', '[name=commit_message]');
    this.signoff = this.child('Добавить подпись автора', '[name=signoff]');
    this.submit = this.child('Сохранить', '#commit-button');
    this.cancel = this.child('Отмена', '.sc-button_danger');
  }
}
