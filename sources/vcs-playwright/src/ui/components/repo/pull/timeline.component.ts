import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import CommentForm from '@vcs-pw/ui/components/repo/pull/comment-form.component';
import Comment from '@vcs-pw/ui/components/repo/pull/comment.component';
import MergeForm from '@vcs-pw/ui/components/repo/pull/merge-form.component';

export default class Timeline extends Element {
  readonly mergeForm: MergeForm;
  readonly commentForm: CommentForm;
  readonly post: Comment;
  readonly event: Element;
  readonly commit: Element;
  readonly comment: Comment;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Хронология',
        locator: base.locator('.timeline'),
      });
    } else {
      super(base);
    }

    this.mergeForm = new MergeForm(this.raw);
    this.commentForm = new CommentForm(this.raw);
    this.post = new Comment({ name: 'Пост', locator: this.raw.locator('.first') });
    this.event = this.child('Событие', '.event');
    this.commit = this.child('Коммит', '.singular-commit');
    this.comment = new Comment({
      name: 'Комментарий',
      locator: this.raw.locator('.comment:not(.first)[id^=issuecomment]'),
    });
  }
}
