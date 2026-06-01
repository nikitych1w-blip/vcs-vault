# Скилл: review_spec (BE)

> Общий контекст продукта: `common/product.md`
> Система координат: `common/model.md`
> Формат API-контракта (SA): `sa/role.md`
> Базовые правила OpenAPI в проекте: `../../../sources/vcs-api/README_SA.md`

---

## Назначение

`review_spec` - это backend-скилл для ревью UI OpenAPI-контракта с фокусом на главный вопрос:
**подходит ли спецификация для реализации endpoint-а в backend по действующим нормам команды**.

Область применения: **только UI-спека** (`api/openapi/ui/*`).

---

## Итоговые правила запуска (обязательно)

Эти правила применяются в каждом прогоне `review_spec`, чтобы результат был воспроизводимым:

1. Перед compat-проверкой агент **обязательно спрашивает у пользователя**, с какой базой сравнивать (`BASE`).
2. Если пользователь не задает базу явно, использовать базу прошлого релиза: `origin/release/SourceControl/9.7.0`.
3. Перед запуском обязательно подтвердить, что `BASE` - это именно нужный релиз для текущей задачи.
4. Проверка выполняется полной командой compat:
   - `make check-api-compat-all BASE=<base_ref> FAIL_LEVEL=ERR` (в `vcs-api`).
5. В отчет включаются **только ошибки уровня ERR**. `WARN/INFO` в блок findings не включаются.
6. Без фактического запуска compat-проверки вердикт `approve` и `approve-with-comments` не допускается.

---

## Быстрый запуск (шпаргалка)

1. Спросить у пользователя базу сравнения (`BASE`).
2. Если пользователь не указал базу, взять:
   - `origin/release/SourceControl/9.7.0`.
3. Выполнить:
   - `make check-api-compat-all BASE=<base_ref> FAIL_LEVEL=ERR` (в `vcs-api`).
4. В отчет вынести:
   - `BASE`,
   - команду запуска,
   - итог (`PASS/FAIL`, количество `ERR`),
   - список только `ERR`-нарушений.

---

## Зоны ответственности

- Проверка качества контракта UI OpenAPI перед backend-реализацией.
- Проверка совместимости контракта с текущим состоянием backend-кода.
- Выявление разрывов между спецификацией, codegen и маршрутизацией.
- Формирование вердикта `approve` / `approve-with-comments` / `request-changes`.
- Явная классификация проблем: блокеры vs рекомендации.

---

## Артефакты

| Артефакт | Описание |
|----------|----------|
| Отчет ревью `review_spec` | Единый отчет по endpoint-ам с вердиктом |
| Матрица реализации endpoint-ов | Статус `Draft` / `ReadyForBackend` / `ImplementedInBackend` / `Mismatch` |
| Список блокеров | Изменения, без которых backend-реализация рискованна или некорректна |
| Список рекомендаций | Улучшения контракта без немедленного блокирования |

---

## Порядок ревью endpoint-а

Использовать порядок чтения (сверху вниз по контракту, затем по связям):

1. Найти endpoint в `ui/index.yaml` (`paths` -> `$ref` в `domains/*/routes.yaml`).
2. Прочитать паспорт операции: `tags`, `summary`, `operationId`, `x-internal`, `x-required-privilege`.
3. Проверить вход: `parameters`, `requestBody`, `security`.
4. Проверить выход: `responses` и все коды ошибок.
5. Раскрыть все `$ref` до `components/schemas` (не останавливаясь на промежуточном `responses`).
6. Проверить связь с backend-кодом: codegen (`StrictServerInterface`) -> роут (`routers/sc/api.go`) -> handler/service.
7. Перед запуском compat-check обязательно уточнить у пользователя базовую версию сравнения (`BASE`: ветка/тег/commit).
   - Рекомендуемая формулировка вопроса:  
     `С какой релизной веткой сравнивать compat-check? По умолчанию origin/release/SourceControl/9.7.0.`
   - База по умолчанию для прошлого релиза: `origin/release/SourceControl/9.7.0`.
8. Обязательно выполнить validation-checks:
   - в `vcs-api`: `make check-api-compat-all BASE=<base_ref> FAIL_LEVEL=ERR`.
   Без фактического запуска `make check-api-compat-all` вердикт `approve` и `approve-with-comments` не допускается.

---

## Блокирующий чеклист (готовность к backend-реализации)

Пункты ниже считаются блокирующими, если endpoint помечен как готовый к реализации.

| Проверка | Как проверять | Блокер, если |
|----------|---------------|--------------|
| Версия и структура спеки | `ui/index.yaml`, доменные `routes.yaml` | Сломана структура `$ref` или потеряна операция в `paths` |
| `operationId` | В `routes.yaml` + bundle | `operationId` отсутствует, неуникален, нестабилен |
| `x-internal` | На уровне метода (`get/post/...`) | Статус черновика неявен или проставлен не на уровне операции |
| Контракт входа | `parameters`, `requestBody`, схемы | Нельзя однозначно разобрать вход в handler |
| Контракт выхода | `responses`, `common/errors.yaml`, доменные responses | Нет корректной матрицы 2xx/4xx/5xx для реализации |
| Security | Глобальный `security`, `cookieAuth` | Схема безопасности противоречива или отсутствует |
| Привилегии | `x-required-privilege` vs `routers/sc/api.go` | Спека и backend проверяют разные права или privilege не определен для защищенной операции |
| Проверки инструментами | `make check-api-compat-all BASE=<base_ref> FAIL_LEVEL=ERR` (в `vcs-api`) | Контракт не проходит проверку обратной совместимости без согласования breaking change |

---

## Контекст реализации endpoint-ов (что есть и чего нет)

Для каждого endpoint обязательно определять статус реализации.

### Статусы

- `Draft`: в спеке есть `x-internal: true`; endpoint не считается готовым к реализации.
- `ReadyForBackend`: `x-internal` снят, контракт валиден, операция видна в codegen-интерфейсе.
- `ImplementedInBackend`: есть `StrictServerInterface` + route в `routers/sc/api.go` + handler/service.
- `Mismatch`: несоответствие между спекой и кодом (например, internal в спеке, но маршрут уже подключен).
- `UnknownBackendState`: backend checkout недоступен для проверки (невозможно подтвердить codegen/route/handler).

### Матрица проверки (обязательная)

```markdown
| Endpoint | operationId | x-internal | x-required-privilege | StrictServerInterface | Route(api.go) | Handler/Service | Статус | Комментарий |
|----------|-------------|------------|----------------------|-----------------------|---------------|-----------------|--------|-------------|
| /repos/{project_name}/{repo_name}/pulls/{index}/activity GET | GetPRActivity | true | read | есть | есть | есть | Mismatch | Endpoint уже живет в backend, но в спеке еще черновик |
```

### Минимум 3 сигнала реализованности

1. Сигнал из OpenAPI: `operationId`, `x-internal`, `x-required-privilege`.
2. Сигнал из codegen: операция есть в `StrictServerInterface` (`api/pkg/servers/ui/*/*-mini.gen.go`).
3. Сигнал из роутинга: endpoint подключен в `routers/sc/api.go` с корректной проверкой прав.

---

## Рекомендательный чеклист (best practices)

- Коды ответов не противоречат semantics метода (`201/202/204` и тело ответа).
- Ошибки переиспользуют `common/errors.yaml`, а не дублируются вручную.
- Параметры переиспользуются через `common/params.yaml` или доменные `params.yaml`.
- Нейминг `operationId` консистентен (PascalCase, без случайного camelCase).
- `x-required-privilege` выражает реальный доступ и согласован с backend middleware.
- Путь и домен соответствуют уже принятому path-pattern (`/repos/...` vs `/projects/.../repos/...`).

---

## Формат отчета ревью

```markdown
## review_spec: <ветка/PR>

**Surface**: UI
**BASE для compat-check**: <ветка/тег/commit>
**Команда compat-check**: `make check-api-compat-all BASE=<base_ref> FAIL_LEVEL=ERR`
**Результат compat-check**: PASS | FAIL (ERR=<n>)
**Вердикт**: approve | approve-with-comments | request-changes
**Объем ревью**: <список endpoint-ов>

### 1) Blocking findings
1. [Endpoint + method] <проблема>
   - Contract: <файл/поле в спеке>
   - Backend impact: <почему нельзя корректно реализовать>
   - Fix: <что нужно исправить>

### 2) Implementation context matrix
| Endpoint | operationId | x-internal | x-required-privilege | StrictServerInterface | Route(api.go) | Handler/Service | Статус | Комментарий |
|----------|-------------|------------|----------------------|-----------------------|---------------|-----------------|--------|-------------|

### 3) Recommendations
- ...

### 4) Validation checks (обязательно)
- [ ] make check-api-compat-all BASE=<base_ref> FAIL_LEVEL=ERR (`vcs-api`) - команда выполнена, результат PASS

### 5) Нарушения обратной совместимости (только ERR)
- [ERR][<rule-id>] <METHOD> <PATH> - <проблема>
  - Источник: <файл/узел спецификации>
  - Влияние: <чем опасно для обратной совместимости>
  - Исправление: <как устранить>
```

Если ERR-нарушений нет:
```markdown
### 5) Нарушения обратной совместимости (только ERR)
- ERR-нарушений не найдено.
```

---

## Формат точечного комментария к операции

```markdown
### <METHOD> <PATH>

**operationId**: <...>
**Тип**: blocker | recommendation
**Проблема**: <что не так>
**Контракт**: <routes.yaml / responses.yaml / schemas.yaml>
**Контекст backend**: <codegen / route / handler>
**Ожидание**: <как должно быть по нормам>
```

---

## Принципы работы

- Сначала контрактная корректность, затем соответствие реализации.
- Не смешивать состояния "спека корректна" и "endpoint уже реализован".
- Любой вывод должен быть трассируем: spec -> codegen -> router -> handler/service.
- Для UI использовать только UI-источники; не переносить правила v2/v3 без явного запроса.
- Если обнаружен `Mismatch`, фиксировать как минимум одним блокером до синхронизации контракта и backend.
- `approve` / `approve-with-comments` допустимы только после фактического запуска `make check-api-compat-all` или явного запроса заказчика пропустить запуск.
- Базовая версия compat-check (`BASE`) должна быть явно согласована с пользователем и отражена в отчете.
- В отчет включать результаты compat только уровня `ERR`; `WARN/INFO` не включать в блок findings.
- Формулировки в отчете должны быть на русском и однозначно отвечать на вопросы: что проверяли, с какой базой, какой результат.

---

## Чего избегать

- Ревью "по summary", без раскрытия `$ref` до конечной схемы.
- Ревью без проверки `x-internal` на уровне конкретной операции.
- Игнорирование `x-required-privilege` и расхождений с `checkPrivilege(...)`.
- Формулировки без указания endpoint-а, метода и поля спецификации.
- Аппрув спецификации без признаков прохождения `make check-api-compat-all`.
- Смешивание `WARN/INFO` с блокирующими compat-ошибками уровня `ERR` в основном списке findings.
