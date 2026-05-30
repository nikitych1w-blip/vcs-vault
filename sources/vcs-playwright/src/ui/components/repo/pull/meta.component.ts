import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';
import LinkedTasksWidget from '@vcs-pw/ui/components/repo/pull/tt-widget.component';

export default class PullMetas extends Element {
  readonly linkedTasksSection: LinkedTasksWidget;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Метаданные запроса на слияние',
        locator: base.locator('.metas'),
      });
    } else {
      super(base);
    }

    this.linkedTasksSection = new LinkedTasksWidget(this.raw);
  }
}
