# Роль: QA-автоматизатор (QAA)

> Общий контекст: `common/product.md` · Координаты: `common/model.md`
> Сценарий SA→QA→QAA: `faq/scenario-endpoint-to-test.md` (Фаза 5)
> Вход: `qa/test-plan.md` (тест-кейсы QA), `be/design.md` (контракт), узлы test-model.

Автотесты продукта живут в репозитории **`vcs-playwright`** (TS + Playwright). Стек выужен из реального кода/доков репо (источник правды — `sources/vcs-playwright/docs/`).

## Стек (факты из репо)

| Аспект | Технология | Где |
|--------|-----------|-----|
| Раннер | **Playwright** (TS) | `@playwright/test`, `playwright.config.ts` |
| Отчёты | **Allure** + `@vcs/test-culture-playwright-reporter` | `npm run allure` |
| Типы из контракта | **@hey-api/openapi-ts** → **zod** из `vcs-api` (submodule `spec/`) | `openapi-ts.config.ts`, `npm run generate:zod` |
| Валидация ответов | **ajv** + JSON-схемы | `tests/resources/schemas` |
| API-клиент | `BackApi`/`ApiWrapper` (axios) | `src/api`, `docs/api.md` |
| UI | **Page Object Model** + класс `Element` | `src/ui/{pages,components}`, `docs/page-object-model.md`, `element.md` |
| Интеграции | Kafka, Postgres (`pg`), Vault, S3, faker | `src/services` |
| Линт/качество | eslint (+playwright, filename-rules), prettier, `madge --circular` | `npm run lint`/`madge:circular` |

## Зоны ответственности

- Автотесты на каждый TC из `qa/test-plan.md`: API/Kafka и/или UI.
- Трассируемость **узел test-model → TC → автотест** (Фаза 5 сценария).
- Поддержка zod-типов из контракта (`generate:zod`) и схем валидации (ajv).
- Очистка ресурсов через фикстуру `cleanup`; отчёты в Allure.
- Прохождение линтов и ревью автотестов.

## Скиллы роли (этой папки)

| Скилл | Этап | О чём |
|-------|------|-------|
| [setup-run.md](setup-run.md) | qaa-tasks/apply | окружение, запуск, Vault, Allure |
| [codegen.md](codegen.md) | qaa-tasks/apply | zod-типы из vcs-api (`generate:zod`, submodule spec) |
| [api-tests.md](api-tests.md) | apply | API/Kafka тесты: BackApi, isStatus, step, ajv, snake_case DTO |
| [ui-tests.md](ui-tests.md) | apply | Page Object Model + класс Element, data-testid |
| [conventions.md](conventions.md) | apply | нейминг (kebab + суффиксы), структура, фикстура cleanup |
| [review.md](review.md) | review | lint/prettier/madge, Allure, трассировка node→TC→тест |

## Принципы

- **Источник контракта — `vcs-api`** (submodule `spec/`); типы **генерируются** (zod), руками не пишутся.
- Каждый автотест связан с **TC и узлом** test-model (трассируемость).
- DTO/query — **snake_case** (как в API); код — camelCase/PascalCase по нейминг-гайду.
- Действия оборачивать в `step()` — для информативного Allure.
- Ресурсы чистить через `cleanup.push()` (LIFO, не валит тест).

### Ретро-чеклист автотестов (обязателен)

- Проверять, что query-параметры уходят в API ровно по контракту (включая CSV-поля без пробелов), даже если часть фильтров задаётся через URL.
- Добавлять негативные сценарии на «невалидный параметр» через реальный parser/wrapper endpoint, а не только через мок произвольного 400-ответа.
- В UI e2e фиксировать визуальные индикаторы статусов (`private/internal/...`) отдельными ассертами/снапшотами.
- В pre-merge smoke включать проверку, что middleware-цепочка ручки подключена (401/403/404 маршрута) и не заменена ручной логикой handler.

## Окружение и пути

Репозиторий `vcs-playwright` и submodule `spec` (`vcs-api`) — **вне vault**, расположение зависит от окружения; не хардкодить, уточнять у разработчика. В примерах `<vcs-playwright>` — плейсхолдер.
