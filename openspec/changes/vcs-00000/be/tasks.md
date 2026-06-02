> Внимание: `qa/test-plan.md` отсутствует на момент подготовки чеклиста. Раздел тестов сформирован по `be/design.md` и `vault/skills/be/testing.md`; после появления QA-плана требуется сверка и актуализация.

## 1. Реализация

- [x] 1.1 Роутинг: зарегистрировать `GET /repos/search` в роутере (`api.go`), подключить auth middleware и проверку области доступа пользователя.
- [x] 1.2 Handler: провалидировать query-параметры (`q`, `project_name`, `language`, `archived`, `is_watching`, `is_favorite`, `is_in_source_hub`, `sort`, `page`, `limit`) с правилами для `sort`/CSV/пагинации и tri-state фильтров.
- [x] 1.3 Service: реализовать бизнес-логику поиска (scope доступа, проверка `project_name`, нормализация сортировки по whitelist `update|name|stars|forks`, вызов repository, обработка доменных ошибок).
- [x] 1.4 DTO: описать internal-структуры запроса/ответа (`ReposSearchQuery`, `ReposSearchResult`, `RepoShortListItemEntity`, `OptionalBool`, `OptionalString`, `SortField`) и контракты между слоями.
- [x] 1.5 Маппинг: реализовать преобразования внешний ответ `ReposShortList`/`RepoShortListItem` <-> internal DTO/entity в `convert.go`.

## 2. Тесты

- [x] 2.1 Unit: handler — позитивный кейс (`200`) с корректным маппингом результата и `pagination`.
- [x] 2.2 Unit: handler — негативные кейсы (`400`, `401`, `403`, `404`, `500`), включая валидации параметров, отсутствие доступа/проекта и инфраструктурную ошибку сервиса.
- [x] 2.3 Unit: service — бизнес-логика (scope, фильтры, сортировка, пагинация, доменные ошибки), только generated-моки `mockery` (без самописных моков).

## 3. Документация

- [x] 3.1 OpenAPI-спека обновлена/проверена на актуальность контракта `GetReposSearch` и ошибок `400/401/403/404/500`.
- [x] 3.2 Swagger-документация сгенерирована (bundle/postman artifacts) и зафиксирована в PR.
