import { Page } from '@playwright/test';

import Element from '@vcs-pw/ui/components/element.component';
import BasePage from '@vcs-pw/ui/pages/base.page';
import RepoCard from '@vcs-pw/ui/components/repo/card.component';

export default class ProjectProfilePage extends BasePage {
  readonly filterSort: Element;
  readonly filterSortUpdated: Element;
  readonly filterUpdatedLong: Element;
  readonly filterByAlphabet: Element;
  readonly filterByEndAlphabet: Element;
  readonly filterPopular: Element;
  readonly filterNoPopular: Element;
  readonly filterMoreForks: Element;
  readonly filterLessForks: Element;
  readonly repoCard: RepoCard;

  constructor(readonly page: Page) {
    super(page, 'Проект. Профиль', page.locator("//main[.//div[@data-testid='OrganizationRepoPage.Filters']]"));
    this.filterSort = new Element({
      name: 'Сортировка',
      locator: this.content.getByTestId('OrganizationRepoPage.Filters.Sort'),
    });
    this.filterSortUpdated = this.filterSort.child('Недавно обновленные', (base) =>
      base.getByText('Недавно обновленные'),
    );
    this.filterUpdatedLong = new Element({
      name: 'Обновлённые давно',
      locator: this.page.getByText('Обновлённые давно'),
    });
    this.filterByAlphabet = new Element({ name: 'По алфавиту', locator: this.page.getByText('По алфавиту') });
    this.filterByEndAlphabet = new Element({
      name: 'С конца алфавита',
      locator: this.page.getByText('С конца алфавита'),
    });
    this.filterPopular = new Element({
      name: 'Популярные',
      locator: this.page.getByText('Популярные', { exact: true }),
    });
    this.filterNoPopular = new Element({
      name: 'Не популярные',
      locator: this.page.getByText('Не популярные', { exact: true }),
    });
    this.filterMoreForks = new Element({ name: 'Больше форков', locator: this.page.getByText('Больше форков') });
    this.filterLessForks = new Element({ name: 'Меньше форков', locator: this.page.getByText('Меньше форков') });
    this.repoCard = new RepoCard(this.content);
  }
}
