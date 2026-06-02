# Daily Intent Contract

## Intent

Разработчики, тимлиды и DevOps получают новую страницу списка запросов на слияние в платформенном FE — адаптивную, быструю, встраиваемую как MFE — как часть замены старого SSR-интерфейса.

## Why Now

Ключевая бизнес-цель — миграция пользователей ПАО из Bitbucket в SourceControl. CSI продукта составляет 57.5% при целевом показателе выше. Топ-2 боли пользователей — проблемы UX/интерфейса (29.2%) и низкая скорость (21.4%) — напрямую адресуются новым платформенным FE. Страница MR — следующий обязательный сценарий после кода и репозиториев.

## Target Audience

Разработчики, тимлиды, DevOps ПАО — ежедневно работающие с запросами на слияние в SourceControl.

## Expected Outcome

Пользователь работает с MR полностью в новом платформенном интерфейсе без переключения в SSR. Страница загружается быстро, работает как MFE, выглядит единообразно. Барьер для миграции с Bitbucket снижается, CSI растёт.

### Success Metrics

- Время загрузки страницы ≤ 200 мс (сейчас скорость — слабейший критерий CSI: 46.6%)
- Страница работает как MFE без переключения в SSR
- Фильтры, статусы CI и одобрений работают корректно
- CSI по критерию «Удобство UX» растёт относительно текущих 47.4%

## Key Hypothesis

Новый платформенный интерфейс MR с поддержкой MFE улучшит CSI по критериям UX и скорости и снизит барьер для миграции пользователей ПАО с Bitbucket на SourceControl.

## Learning Goal

Проверить, достаточно ли нового платформенного FE с MFE-архитектурой и web2 API для того, чтобы пользователи ПАО захотели перейти с Bitbucket — и как это повлияет на CSI по критериям UX и скорости.

## What Changes

- Добавляем capability для поиска репозиториев через `GET /repos/search` (web2).
- Фиксируем требования к входным query-параметрам: `q`, `project_name`, `language`, `archived`, `is_watching`, `is_favorite`, `is_in_source_hub`, `sort`, `page`, `limit`.
- Фиксируем правила сортировки и пагинации в ответе (`pagination` + `data`).
- Фиксируем контракт успешного ответа `ReposShortList` и обязательные коды ошибок `400/401/403/404/500`.
- Scope изменения ограничен только endpoint `/repos/search` без расширения на другие маршруты.

## Capabilities

### New Capabilities
- `repos-search`: Поиск репозиториев с фильтрацией, сортировкой и пагинацией через `GET /repos/search`.

## Impact

- OpenAPI path: `sources/vcs-api/api/openapi/ui/index.yaml` (`/repos/search` -> `#/ReposSearch`).
- Описание endpoint: `sources/vcs-api/api/openapi/ui/domains/repos/routes.yaml` (`ReposSearch`).
- Query-параметры: `sources/vcs-api/api/openapi/ui/domains/repos/params.yaml` и `sources/vcs-api/api/openapi/ui/common/params.yaml`.
- Ответы и схемы: `sources/vcs-api/api/openapi/ui/domains/repos/responses.yaml`, `sources/vcs-api/api/openapi/ui/domains/repos/schemas.yaml`, `sources/vcs-api/api/openapi/ui/common/pagination.yaml`.

## Risks

- Web2 API не возвращает все нужные поля → нужна доработка BE
- Платформенные компоненты не покрывают нужные UI-паттерны → FE тратит время на новые компоненты
- MFE-интеграция требует согласования контракта с платформой → задержка на стыке команд

### Recommended Focus

SA генерирует proposal + specs → BE проверяет web2 API по OpenAPI спеке → FE стартует с макета списка с учётом MFE-контракта параллельно.