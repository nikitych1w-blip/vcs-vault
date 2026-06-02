# QAA · Нейминг, структура, cleanup

Скилл-выжимка. Заметки — `<vcs-playwright>/docs/naming-convention.md`, `cleanup.md`.

## Нейминг файлов (kebab-case + суффикс по типу)

| Тип | Папка | Суффикс / пример |
|-----|-------|------------------|
| API-сервис | `src/api/<v>/<resource>/` | `{resource}.api.ts` (`branches.api.ts`) |
| UI-компонент | `src/ui/components/` | `{name}.component.ts` (`sidemenu.component.ts`) |
| UI-страница | `src/ui/pages/` | `{name}.page.ts` (`settings.page.ts`) |
| Сервис | `src/services/` | `{name}.service.ts` (`auth.service.ts`) |
| Утилита | `src/utils/` | `{name}.util.ts` (`string.util.ts`) |
| Тип | `src/types/` | `{name}.type.ts` (`config.type.ts`) |

Код: классы — **PascalCase** (`ApiService`), функции/переменные — **camelCase**, константы — **UPPER_SNAKE_CASE**. Избегать общих имён (`utils.ts`, `helpers.ts`).
> Исключение: DTO/query_params — **snake_case** (соответствие API), см. [[api-tests]].

## Структура тестов

`tests/src/{ui, api, s3, git, task-tracker}` — наборы по областям; `tests/resources/{testdata, schemas}` — данные и JSON-схемы (ajv).

## Фикстура `cleanup` (обязательно)

`import { test } from '@vcs-pw/fixtures';` — у теста есть `cleanup`. Добавлять очистку **сразу после создания ресурса**; выполняется в **LIFO** после теста (даже при падении), ошибки очистки логируются (WARN), тест не валят.

```ts
test('...', async ({ cleanup }) => {
  const user = await userService.createUser('John');
  cleanup.push(() => userService.deleteUser(user.id));
  // ...
});
```

## Алиасы импортов

`@vcs-pw/*` (`@vcs-pw/ui`, `@vcs-pw/test`, `@vcs-pw/fixtures`).

Связано: [[api-tests]], [[ui-tests]], [[review]], [[role]].
