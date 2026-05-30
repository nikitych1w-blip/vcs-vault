import { isParentType, ParentType } from '@vcs-pw/ui';
import Element, { ElementOptions } from '@vcs-pw/ui/components/element.component';

export default class RepoCard extends Element {
  readonly title: Element;

  constructor(base: ParentType | ElementOptions) {
    if (isParentType(base)) {
      super({
        name: 'Карточка репозитория',
        locator: base.getByTestId('OrganizationRepoPage.ReposList.RepoCard'),
      });
    } else {
      super(base);
    }
    this.title = this.child('Название', (base) => base.getByTestId('OrganizationRepoPage.ReposList.RepoCard.RepoName'));
  }
}
