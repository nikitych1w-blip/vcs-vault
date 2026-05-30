import { Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';
import { step } from '@vcs-pw/test';
import { Endpoint, EndpointTemplates, TimeoutOptions } from '@vcs-pw/ui';
import NavBar from '@vcs-pw/ui/components/navbar.component';
import SideMenu from '@vcs-pw/ui/components/sidemenu/sidemenu.component';
import { formatString } from '@vcs-pw/utils/string.util';
import Element from '../components/element.component';

type PageContext = Record<string, string | number>;

const PAGE_LOAD_TIMEOUT = 20 * 1000;

export default abstract class BasePage {
  readonly sideMenu: SideMenu;
  readonly navBar: NavBar;
  readonly flashSuccess: Element;
  readonly flashError: Element;

  private readonly error;

  constructor(
    protected readonly page: Page,
    protected readonly name: string,
    protected readonly content: Locator,
  ) {
    this.sideMenu = new SideMenu(page);
    this.navBar = new NavBar(page);
    this.error = new Element({ name: 'Ошибка', locator: this.page.locator('.error-page') });
    this.flashSuccess = new Element({ name: 'Уведомление об успехе', locator: this.content.locator('.flash-success') });
    this.flashError = new Element({ name: 'Уведомление об ошибке', locator: this.content.locator('.flash-error') });
  }

  /**
   * Переходит на URL, соответствующий указанному конечному пункту (эндпоинту), подставляя параметры из контекста.
   *
   * Метод использует предопределённые шаблоны URL ({@link EndpointTemplates}), в которые подставляются значения
   * из переданного контекста. Плейсхолдеры в шаблонах имеют вид `{ключ}`, например `{project}`, `{repo}`, `{branch}` и т.д.
   *
   * @param endpoint - Эндпоинт из перечисления {@link Endpoint}, определяющий целевую страницу.
   * @param context - Необязательный объект, содержащий значения для подстановки в шаблон пути.
   *                  Ключи объекта должны соответствовать плейсхолдерам в шаблоне (без фигурных скобок).
   *                  Поддерживаются строки, числа.
   *
   * @example
   * // Переход на вкладку "Код" для ветки 'main'
   * await page.goToEndpoint(Endpoint.REPOSITORY_CODE_BRANCH, {
   *   project: 'my-project',
   *   repo: 'my-repo',
   *   branch: 'main'
   * });
   *
   * @example
   * // Переход на главную страницу проекта
   * await page.goToEndpoint(Endpoint.PROJECT_HOME_PAGE, { project: 'my-project' });
   */
  async goToEndpoint(endpoint: `${Endpoint}`, context?: PageContext): Promise<void> {
    await step(`Переход на эндпоинт "${endpoint}"`, async () => {
      const path = formatString(EndpointTemplates[endpoint], context ?? {});
      await this.page.goto(path, { waitUntil: 'commit' });
    });
  }

  async expectToBeOpened(): Promise<void> {
    return step(`Ожидание, что страница "${this.name}" открыта`, async () => {
      const contentOrError = this.content.or(this.error.raw);
      await expect(contentOrError).toBeAttached({ timeout: PAGE_LOAD_TIMEOUT });
      await this.error.expect.notToBeAttached({ timeout: 1 });
    });
  }

  async expectNotToBeOpened(): Promise<void> {
    return step(`Ожидание, что страница "${this.name}" не отображается`, () =>
      expect(this.content).not.toBeAttached({ timeout: PAGE_LOAD_TIMEOUT }),
    );
  }

  async expectToHaveTitle(expected: string | RegExp, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что заголовок страницы равен "${expected}"`, () =>
      expect(this.page).toHaveTitle(expected, options),
    );
  }

  async expectNotToHaveTitle(expected: string | RegExp, options?: TimeoutOptions): Promise<void> {
    return step(`Ожидание, что заголовок страницы не равен "${expected}"`, () =>
      expect(this.page).not.toHaveTitle(expected, options),
    );
  }

  async expectToHaveURL(
    expected: string | RegExp,
    options?: {
      ignoreCase?: boolean | undefined;
    } & TimeoutOptions,
  ): Promise<void> {
    return step(`Ожидание, что URL страницы равен "${expected}"`, () => expect(this.page).toHaveURL(expected, options));
  }

  async expectNotToHaveURL(
    expected: string | RegExp,
    options?: {
      ignoreCase?: boolean | undefined;
    } & TimeoutOptions,
  ): Promise<void> {
    return step(`Ожидание, что URL страницы не равен "${expected}"`, () =>
      expect(this.page).not.toHaveURL(expected, options),
    );
  }
}
