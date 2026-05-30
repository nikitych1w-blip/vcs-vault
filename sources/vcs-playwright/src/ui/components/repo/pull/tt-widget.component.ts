import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import List from '@vcs-pw/ui/components/list.component';
import LinkedTask from '@vcs-pw/ui/components/repo/pull/tt-card.component';

export default class LinkedTasksWidget extends Element {
  readonly title: Element;
  readonly placeholder: Element;
  readonly taskList: List<LinkedTask>;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: "Виджет 'Связанные задачи'",
        locator: base.locator('.tt-widget'),
      });
    } else {
      super(base);
    }

    this.title = this.child('Заголовок', '.tt-header');
    this.placeholder = this.child('Заполнитель', '.tt-empty');
    this.taskList = new List<LinkedTask>({
      name: 'Список связанных задач',
      locator: this.raw.locator('.tt-list'),
      itemClass: LinkedTask,
    });
  }
}
