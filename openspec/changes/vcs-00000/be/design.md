## Context

`vcs-00000` задает backend-дизайн для сценария поиска репозиториев в `web2` через `GET /repos/search`.

Источники:
- `openspec/changes/vcs-00000/sa/proposal.md`
- `openspec/changes/vcs-00000/sa/specs/repos-search/spec.md`
- `sources/vcs-api/api/openapi/ui/index.yaml`
- `sources/vcs-api/api/openapi/ui/domains/repos/{routes,params,schemas,responses}.yaml`
- `sources/vcs-api/api/openapi/ui/common/{params,errors,pagination}.yaml`

Шаг 0 (гейт `review_spec_ui`, source of truth: `sources/vcs-api`):
- Endpoint: `GET /repos/search`, `operationId: GetReposSearch`, `x-internal` не выставлен (операция публичная).
- Вход покрывает `q`, `project_name`, `language`, `archived`, `is_watching`, `is_favorite`, `is_in_source_hub`, `sort`, `page`, `limit`.
- Выход покрывает `200` (`ReposShortList`) и `400/401/403/404/500` (`ErrorResponse`).
- Security: `cookieAuth` на уровне UI-спеки.
- Compat-check (ERR-only):
  - `sc-api-compat check --repo-root /home/khalbashkeev.p.s@sbertech.ru/Development/vcs-vault --spec sources/vcs-api/api/openapi/ui/openapi_ui_bundle.yaml --base origin/main --head worktree --fail-level ERR`
  - Result: `PASS (ERR=0, WARN=0, INFO=0)`.
- Verdict: **ReadyForBackend**.

Контекст реализованности:

| Endpoint | operationId | x-internal | x-required-privilege | StrictServerInterface | Route(api.go) | Handler/Service | Статус | Комментарий |
|---|---|---|---|---|---|---|---|---|
| `GET /repos/search` | `GetReposSearch` | снят | не задан | UnknownBackendState | UnknownBackendState | UnknownBackendState | ReadyForBackend | Проверка codegen/route/handler выполняется в репозитории `gitea` на этапе реализации |

Координата test-model: `API / web2 / Проект / Репозитории / Поиск` (`lv6-lv8`, `#SC #api #web2 #repo #project #ПАО`).

## Goals / Non-Goals

**Goals:**
- Зафиксировать BE-flow `handler -> service -> repository` для `GET /repos/search`.
- Описать валидацию, auth/scope, фильтрацию, сортировку и пагинацию.
- Зафиксировать mapping ошибок в `400/401/403/404/500`.
- Зафиксировать DTO/Entity границы и зависимости операции.

**Non-Goals:**
- Изменение OpenAPI-контракта `sources/vcs-api`.
- FE-логика и UI-состояния.
- Side effects в Kafka/Git.
- Изменение схемы БД и миграции `sc-migrator`.

## Decisions

### Endpoint(s)

| METHOD path | Описание |
|---|---|
| `GET /repos/search` | Поиск репозиториев по `q` в доступной пользователю области; при `project_name` поиск ограничивается конкретным проектом |

Параметры: `q`, `project_name`, `language`, `archived`, `is_watching`, `is_favorite`, `is_in_source_hub`, `sort`, `page`, `limit`.

### Auth

- Аутентификация: `cookieAuth`.
- Без валидной сессии: `401 Unauthorized`.
- Авторизация:
  - без `project_name` — только в видимой пользователю области;
  - с `project_name` — проверка существования проекта и прав доступа.
- Недостаток прав: `403 Forbidden`.
- Несуществующий `project_name`: `404 NotFound`.

### Flow

1. Router направляет `GET /repos/search` в handler `GetReposSearch`.
2. Handler запускает трейсинг, парсит query и валидирует:
   - `sort` по regex `^[a-z_]+(:asc|:desc)?(,[a-z_]+(:asc|:desc)?){0,2}$`;
   - `language` как CSV без пробелов;
   - `page/limit` как положительные значения;
   - tri-state фильтры (`archived`, `is_watching`, `is_favorite`, `is_in_source_hub`).
3. Handler формирует request entity и вызывает `ReposSearchService`.
4. Service определяет scope доступа пользователя; при `project_name` возвращает доменные `ErrProjectNotFound` или `ErrForbidden`.
5. Service нормализует сортировку (whitelist: `update`, `name`, `stars`, `forks`) и передает фильтр в `ReposSearchDB`.
6. Repository выполняет read-only выборку через `builder.And/Or/Eq`, применяет фильтры, сортировку, пагинацию и подсчет `total_items`.
7. Service возвращает entity-результат; handler в `convert.go` маппит в `ReposShortList` и отдает `200`.

### Error Handling

| Условие | Код | Ответ |
|---|---:|---|
| Невалидный `sort` | 400 | `ErrorResponse` (`title/detail/validation`) |
| Невалидный `language` | 400 | `ErrorResponse` |
| Невалидные `page`/`limit` | 400 | `ErrorResponse` |
| Нет cookie-аутентификации | 401 | `ErrorResponse` |
| Нет прав на область поиска | 403 | `ErrorResponse` |
| `project_name` не найден | 404 | `ErrorResponse` |
| Неожиданная ошибка сервиса/БД | 500 | `ErrorResponse` |

Правила:
- Ошибки поднимаются с `%w` на каждом слое.
- HTTP-коды формируются только в handler.
- Логирование на boundary: `Debug` для `400/404`, `Warn` для ожидаемых бизнес-веток, `Error` для `500`.
- Пустая выдача — не ошибка (`200`, `data=[]`, валидный `pagination`).

### DTO

Request entity (handler -> service):

```go
type ReposSearchQuery struct {
    Q             string
    ProjectName   OptionalString
    Languages     []string
    Archived      OptionalBool
    IsWatching    OptionalBool
    IsFavorite    OptionalBool
    IsInSourceHub OptionalBool
    Sort          []SortField
    Page          int
    Limit         int
    RequesterID   int64
}
```

Response entity (service -> handler):

```go
type ReposSearchResult struct {
    Pagination Pagination
    Data       []RepoShortListItemEntity
}
```

`RepoShortListItemEntity` маппится в `RepoShortListItem` (включая обязательные поля `id`, `name`, `full_name`, `is_starring`, `is_watching`, `archived`, `updated_at`, `is_in_source_hub`).

### Зависимости

- `sources/vcs-api` (контракт UI API).
- Cookie session + user context.
- Модель прав доступа проекта/репозитория.
- Repository-слой чтения метаданных и пользовательских флагов (`favorite`, `watching`, `in_source_hub`).
- Интеграции: Kafka — нет; Git — нет; LDAP — косвенно через auth.
- БД-миграции не требуются (схема не меняется).

### Архитектурные решения

1. Слои строго разделены: handler не содержит бизнес-логику и не ходит в БД.
2. Tri-state фильтры представлены value-object типами (`OptionalBool`, `OptionalString`), чтобы сохранить семантику "не передан".
3. Сортировка проходит через whitelist mapping для защиты от SQL-инъекций.
4. Service и repository не формируют HTTP-ответы, только доменные данные и ошибки.
5. Трейсинг добавляется в публичные методы handler/service/repository.
6. Операция остается read-only, без транзакционного сценария.

## Risks / Trade-offs

- Отсутствие `x-required-privilege` может размыть точку проверки прав (router vs service).
- Поиск по всем доступным проектам может деградировать на больших объемах данных.
- Тип `string` у `page/limit` в контракте повышает риск ошибок парсинга.
- Фильтр `language` чувствителен к унификации словаря языков в источнике данных.
