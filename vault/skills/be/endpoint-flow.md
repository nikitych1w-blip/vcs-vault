# BE · Реализация ручки для нового фронта (gitea)

Источник: VCS-22821. Контракт живёт в сабмодуле `vcs-api` (см. [[be-submodule]]).

## Короткий flow

0. Прочитать `README_DEV.md`.
1. Обновить спеку: `make update-spec` (в `gitea`).
2. Снять `x-internal` у операции: `make ready-impl-use SURFACE=ui API_PATH='...' METHOD=post`.
3. Убедиться, что кодген обновил контракт (`StrictServerInterface`).
4. Зафиксировать поведение endpoint-а по OpenAPI (happy path, ошибки, права, ограничения).
5. **Сначала** написать unit-тесты ([[be-unit-tests]]).
6. Реализовать endpoint и подключить роут.
7. `make test-backend-correct` перед коммитом.

## Контракт и кодген

- `operationId` из OpenAPI — источник правды для имени операции, поведения, структуры request/response.
- Проверить, что операция появилась в `api/pkg/servers/ui/.../*.gen.go` и метод есть в `StrictServerInterface`.
- `*.gen.go` **руками не редактировать**. Флаги: `ALLOW_ALREADY_PUBLIC=1` (операция уже публичная), `FORCE_UPDATE_CODEGEN=1` (кодген блокируется из-за изменённых generated-файлов).

## Структура пакета endpoint-а

`server.go` (wiring) · `interfaces.go` (зависимости) · `handler_<operationId_snake>.go` (1 операция = 1 файл) · `handler_<...>_test.go` · `convert.go` · `validate.go` · `errors.go`. Детали — [[be-code-architecture]].

## Что делает handler

Только: достать и провалидировать параметры → получить `gitea` context → вызвать сервис → смапить доменные ошибки в типизированные API-ответы (`400/401/403/404/409/500`) → вернуть response DTO.

- Использовать `newServerInterfaceWrapper(...)` и единый `BadRequestJSONErrorHandler`, где применимо.
- Логирование: 400/404 → `log.Debug`; ожидаемые клиентские/бизнес-ошибки → `log.Warn`; инфраструктурные/внутренние → `log.Error` (см. [[be-error-logging]]).

## Границы слоёв

`api/servers/ui → services → modules (опц.) → repository → models`. Handler не ходит в БД/Gitaly; бизнес-логика — в `services`; зависимости через конструкторы и интерфейсы; ошибки оборачиваются `%w` на каждом слое.

## Роутинг и права

Подключить endpoint в `routers/sc/api.go`:
- добавить путь и метод;
- middleware (`isSigned`, `orgAssignment`, `repoAssignment`);
- `checkPrivilege(...)` согласно `x-required-privilege`;
- направить в нужный handler.

## Порядок реализации (обязательный)

1. Зафиксировать поведение из спеки: happy path; матрица ошибок; привилегии (`x-required-privilege`); ограничения payload/query/path.
2. Отдельно проверить неоднозначности контракта **до** кода.
3. Сначала unit-тесты, затем endpoint.

## Чек-лист перед коммитом

- [ ] `operationId` реализован 1:1 (контракт ↔ handler).
- [ ] В `StrictServerInterface` есть метод, сигнатура соблюдена.
- [ ] Роут добавлен в `routers/sc/api.go` с корректным `checkPrivilege`.
- [ ] Unit-тесты добавлены и проходят.
- [ ] Generated-файлы не редактировались вручную.
- [ ] `make test-backend-correct` проходит.

## Anti-patterns

- Редактировать `*.gen.go` руками.
- Бизнес-логика в handler-е.
- Реализация endpoint-а до тестов и формализации поведения.
- Самописные моки вместо generated (см. [[be-unit-tests]]).

Связано: [[be-submodule]], [[be-code-architecture]], [[be-unit-tests]], [[be-error-logging]].
