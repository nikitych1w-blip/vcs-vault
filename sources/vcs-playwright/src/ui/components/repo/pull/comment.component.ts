import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import List from '@vcs-pw/ui/components/list.component';
import Attachment from '@vcs-pw/ui/components/repo/pull/attachment.component';
import CommentForm from './comment-form.component';

export default class Comment extends Element {
  readonly avatar: Element;
  readonly author: Element;
  readonly relativeTime: Element;
  readonly rawContent: Element;
  readonly menu: Element;
  readonly menuDropdown: List<Element>;
  readonly attachment: Attachment;
  readonly editForm: CommentForm;

  constructor(base: ElementOptions) {
    super(base);

    this.avatar = this.child('Аватар', '.timeline-avatar');
    this.author = this.child('Автор', '.author');
    this.relativeTime = this.child('Относительное время', 'relative-time');
    this.rawContent = this.child('Исходный контент', '.raw-content');
    this.menu = this.child('Меню', '.actions .context-dropdown');
    this.menuDropdown = new List<Element>({
      locator: this.menu.raw.locator('.menu'),
      itemLocatorOrFactory: '.item',
    });
    this.attachment = new Attachment(this.raw);
    this.editForm = new CommentForm({ name: 'Форма редактирования', locator: this.raw.locator('.edit-content-zone') });
  }

  async delete() {
    this.raw.page().on('dialog', (dialog) => dialog.accept());
    await this.menu.click();
    await this.menuDropdown.expect.toBeVisible();
    await this.menuDropdown.item.getByText('Удалить').click();
  }

  async startEdit() {
    await this.menu.click();
    await this.menuDropdown.expect.toBeVisible();
    await this.menuDropdown.item.getByText('Редактировать').click();
    await this.editForm.expect.toBeVisible();
  }
}
