# QAA · UI-тесты (Page Object Model + Element)

Скилл-выжимка. Заметки — `<vcs-playwright>/docs/page-object-model.md`, `element.md`. Код — `src/ui/{pages,components}`, тесты — `tests/src/ui`.

## Page Object Model

- **Страница** → `src/ui/pages/<area>/<name>.page.ts`, наследует `base.page.ts`.
- **Компонент** → `src/ui/components/<name>.component.ts`, наследует `Element` (base.component).
- Локаторы определяются **только внутри** классов страниц/компонентов (не в тестах).
- **Композиция > наследование**: компоненты — как зависимости (`readonly` поля), не через наследование.
- Доступ к страницам — через `pageRegistry`; переход — `goToEndpoint` с `pathVariable` (объект контекста).
- Селекторы — по **`data-testid`** (FE обязан их проставлять).

```ts
export default class RepoSettingsPage extends BasePage {
  readonly menu: List;
  constructor(readonly page: Page) {
    super(page, 'Репозиторий. Настройки', page.locator('.page-content.repository.settings'));
    this.menu = new List<Element>({ locator: this.content.locator('.menu'), itemLocatorOrFactory: '.item' });
  }
}
```

## Класс `Element` (обёртка над Locator)

Цель — **информативный Allure**: все действия в `step()`. Создаётся от `ParentType` (Page/Locator/FrameLocator). Дочерние элементы — через **`child(nameSuffix, locatorOrFactory)`** (имя наследует родителя → «Родитель > Ребёнок» в отчёте).

```ts
class Navbar extends Element {
  readonly notifications: Element;
  constructor(base: ParentType) {
    super({ name: 'Панель навигации', locator: base.locator('#navbar') });
    this.notifications = this.child('Уведомления', (b) => b.getByRole('link', { name: 'Уведомления' }));
  }
}
```

`Element` даёт: действия (click/fill/hover…), проверки состояний (isVisible/isDisabled/isChecked…), ожидания (`expect`/`softExpect`), цепочки (`first/last/nth/and/or/filter`).

## Состояния и кейсы

Покрывать (по `qa/test-plan.md`): happy path + пустые состояния + ошибки + edge cases. Ресурсы — через `cleanup` ([[conventions]]).

## Трассируемость

Тест связан с **TC** и **узлом** test-model (web1/web2). Связано: [[conventions]], [[setup-run]], [[role]].
