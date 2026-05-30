import { ParentType, isParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';

export default class MergeForm extends Element {
  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Форма слияния',
        locator: base.locator('.merge.box'),
      });
    } else {
      super(base);
    }
  }
}
