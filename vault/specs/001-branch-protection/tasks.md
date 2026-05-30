---
feature_id: "001"
status: ready
depends_on: [spec.md, plan.md]
release: "3.6"
---

# Tasks: Защита веток репозитория

> Порядок: test-first. TC и требования создаются до реализации.

---

## TASK-001 · SA · Финализировать API-контракты в wiki

**Роль**: SA
**Инструменты**: `wiki-mcp`, `tracker-mcp`
**Приоритет**: P1 · блокирует TASK-003, TASK-004

### Что сделать

Опубликовать API-контракты из `plan.md` в корпоративный wiki.

```
wiki-mcp.create_page(
  space="SC",
  parent="API / v2 / Репозитории",
  title="Branch Protection",
  content=@plan.md#api-contracts
)

tracker-mcp.create_task(
  title="[SA] Branch protection: API-контракты опубликованы",
  node="API / v2 / Репозитории / Branch protection",
  lv=6,
  tags=["api", "v2", "branch", "ПАО"],
  release="3.6"
)
```

**Критерий готовности**: страница в wiki создана, ссылка добавлена в `context.json → tracker_ids_created`.

---

## TASK-002 · QA · TC: Просмотр списка правил защиты (UI)

**Роль**: QA
**Инструменты**: `tms-mcp`, `filesystem-mcp`
**Приоритет**: P1 · #ПАО
**AC**: AC-001.1, AC-001.2, AC-001.3

### Что сделать

```
tms-mcp.create_test_case(
  title="Просмотр списка правил защиты ветки — список, пустое состояние, нет доступа",
  node="UI / Проект / Репозитории / Репозиторий / Настройки / Защита веток / Просмотр",
  lv=7,
  tags=["UI", "SC", "branch", "ПАО"],
  api_version="web2",
  priority="high",
  steps=[
    "1. Войти как администратор репозитория",
    "2. Открыть Настройки → Защита веток",
    "3. Проверить: список правил отображается (AC-001.1)",
    "4. Создать репозиторий без правил, открыть раздел",
    "5. Проверить: заглушка с кнопкой «Добавить правило» (AC-001.2)",
    "6. Войти как не-администратор",
    "7. Проверить: секция недоступна в навигации (AC-001.3)"
  ],
  expected="Правила отображаются корректно, нет доступа отрабатывает 403"
)

filesystem-mcp.update_node_status(
  node="UI / Проект / Репозитории / Репозиторий / Настройки / Защита веток / Просмотр",
  lv=7,
  status="covered",
  tms_id="TC-XXXX"
)
```

---

## TASK-003 · QA · TC: Создание правила защиты (UI)

**Роль**: QA
**Инструменты**: `tms-mcp`, `filesystem-mcp`
**Приоритет**: P1 · #ПАО
**AC**: AC-002.1, AC-002.2, AC-002.3, AC-002.4

### Что сделать

```
tms-mcp.create_test_case(
  title="Создание правила защиты ветки — успех, glob, валидация, конфликт",
  node="UI / Проект / Репозитории / Репозиторий / Настройки / Защита веток / Создание",
  lv=7,
  tags=["UI", "SC", "branch", "ПАО"],
  api_version="web2",
  priority="high",
  steps=[
    "1. Открыть форму «Добавить правило»",
    "2. Ввести паттерн «main», включить «Запретить прямой пуш»",
    "3. Сохранить → правило в списке (AC-002.1)",
    "4. Создать правило с паттерном «release/*»",
    "5. Проверить: применяется к «release/3.6» (AC-002.2)",
    "6. Отправить форму с пустым паттерном",
    "7. Проверить: ошибка «Паттерн обязателен» (AC-002.3)",
    "8. Создать второе правило с паттерном «main»",
    "9. Проверить: ошибка «Правило для этого паттерна уже существует» (AC-002.4)"
  ],
  expected="Правило создаётся, валидация и дубликат обрабатываются корректно"
)

filesystem-mcp.update_node_status(
  node="UI / Проект / Репозитории / Репозиторий / Настройки / Защита веток / Создание",
  lv=7,
  status="covered",
  tms_id="TC-XXXX"
)
```

---

## TASK-004 · QA · TC: Создание правила (API v2)

**Роль**: QA
**Инструменты**: `tms-mcp`, `filesystem-mcp`
**Приоритет**: P1 · #ПАО
**AC**: AC-002.1, AC-002.4

### Что сделать

```
tms-mcp.create_test_case(
  title="API v2: POST branch_protections — создание, конфликт, ошибки авторизации",
  node="API / v2 / Репозитории / Branch protection / Создание",
  lv=7,
  tags=["api", "v2", "SC", "branch", "ПАО"],
  api_version="v2",
  priority="high",
  steps=[
    "1. POST /api/v2/repos/{owner}/{repo}/branch_protections с валидным телом",
    "2. Проверить: 201, тело содержит id и все переданные поля",
    "3. Повторить запрос с тем же паттерном",
    "4. Проверить: 409 Conflict",
    "5. Запрос без токена авторизации",
    "6. Проверить: 401",
    "7. Запрос от не-администратора",
    "8. Проверить: 403"
  ],
  expected="Коды ответов и тела соответствуют контракту из plan.md"
)

filesystem-mcp.update_node_status(
  node="API / v2 / Репозитории / Branch protection / Создание",
  lv=7,
  status="covered",
  tms_id="TC-XXXX"
)
```

---

## TASK-005 · QA · TC: Блокировка прямого пуша (Git CLI + API)

**Роль**: QA
**Инструменты**: `tms-mcp`, `filesystem-mcp`
**Приоритет**: P1 · #ПАО
**AC**: AC-005.1, AC-005.2, AC-005.3

### Что сделать

```
tms-mcp.create_test_case(
  title="Блокировка прямого пуша в защищённую ветку — CLI, API, force push",
  node="UI / Проект / Репозитории / Репозиторий / Код / Ветки / Пуш / Защищённая ветка",
  lv=7,
  tags=["UI", "api", "v2", "SC", "branch", "ПАО", "git"],
  api_version="v2",
  priority="high",
  steps=[
    "1. Создать правило защиты «main» с block_push=true",
    "2. git push origin main → ошибка с «Protected branch» (AC-005.1)",
    "3. POST /api/v2/repos/.../git/refs для main",
    "4. Проверить: 403, body содержит «Branch is protected» (AC-005.2)",
    "5. git push --force origin main",
    "6. Проверить: ошибка про запрет force push (AC-005.3)"
  ],
  expected="Все попытки прямого и форс пуша отклонены с понятными сообщениями"
)

filesystem-mcp.update_node_status(
  node="UI / Проект / Репозитории / Репозиторий / Код / Ветки / Пуш / Защищённая ветка",
  lv=7,
  status="covered",
  tms_id="TC-XXXX"
)
```

---

## TASK-006 · QA · TC: Требование одобрений PR

**Роль**: QA
**Инструменты**: `tms-mcp`, `filesystem-mcp`
**Приоритет**: P2
**AC**: AC-006.1, AC-006.2

### Что сделать

```
tms-mcp.create_test_case(
  title="Требование одобрений: блокировка слияния MR при недостаточном числе approve",
  node="UI / Проект / Репозитории / Репозиторий / Запросы на слияние / Ограничения слияния / Одобрения",
  lv=8,
  tags=["UI", "SC", "merge", "request", "branch"],
  api_version="web2",
  priority="medium",
  steps=[
    "1. Создать правило: required_approvals=2 для «main»",
    "2. Создать MR в main, получить 1 одобрение",
    "3. Проверить: кнопка «Слить» заблокирована, счётчик «ещё 1» (AC-006.1)",
    "4. Получить второе одобрение",
    "5. Проверить: кнопка «Слить» активна (AC-006.2)"
  ],
  expected="Кнопка «Слить» корректно блокируется и разблокируется"
)

filesystem-mcp.update_node_status(
  node="UI / Проект / Репозитории / Репозиторий / Запросы на слияние / Ограничения слияния / Одобрения",
  lv=8,
  status="covered",
  tms_id="TC-XXXX"
)
```

---

## TASK-007 · QA · TC: Удаление и редактирование правила

**Роль**: QA
**Инструменты**: `tms-mcp`, `filesystem-mcp`
**Приоритет**: P1
**AC**: AC-003.1, AC-003.2, AC-004.1, AC-004.2

### Что сделать

```
tms-mcp.create_test_case(
  title="Редактирование и удаление правила защиты — UI",
  node="UI / Проект / Репозитории / Репозиторий / Настройки / Защита веток / Редактирование",
  lv=7,
  tags=["UI", "SC", "branch"],
  api_version="web2",
  priority="high",
  steps=[
    "1. Открыть редактирование существующего правила",
    "2. Добавить required_approvals=2, сохранить",
    "3. Проверить: правило обновлено (AC-003.1)",
    "4. Проверить: поле паттерна заблокировано (AC-003.2)",
    "5. Нажать «Удалить», проверить диалог подтверждения (AC-004.1)",
    "6. Нажать «Отмена», проверить: правило не удалено (AC-004.2)",
    "7. Нажать «Удалить» → подтвердить",
    "8. Проверить: правило удалено из списка"
  ],
  expected="Редактирование и удаление работают корректно"
)
```

---

## TASK-008 · DEV · Реализация GET и POST эндпоинтов

**Роль**: DEV
**Инструменты**: `sc-mcp`, `tracker-mcp`
**Приоритет**: P1 · блокирует TASK-002, TASK-003, TASK-004

### Что сделать

```
tracker-mcp.create_task(
  title="[DEV] Branch protection: реализовать GET /branch_protections и POST /branch_protections",
  description=@plan.md#get-api + @plan.md#post-api,
  node="API / v2 / Репозитории / Branch protection",
  lv=6,
  tags=["api", "v2", "branch", "ПАО"],
  release="3.6",
  acceptance=[
    "GET возвращает список правил с кодом 200",
    "POST создаёт правило с кодом 201",
    "409 при дубликате паттерна",
    "401/403 при отсутствии прав"
  ]
)

sc-mcp.create_branch(
  repo="sourcecontrol-backend",
  branch="feature/SC-001-branch-protection-api"
)
```

---

## TASK-009 · DEV · Реализация PATCH и DELETE эндпоинтов

**Роль**: DEV
**Инструменты**: `tracker-mcp`
**Приоритет**: P1
**Зависит от**: TASK-008

### Что сделать

```
tracker-mcp.create_task(
  title="[DEV] Branch protection: PATCH /branch_protections/{id} и DELETE /branch_protections/{id}",
  description=@plan.md#patch-api + @plan.md#delete-api,
  node="API / v2 / Репозитории / Branch protection",
  lv=6,
  tags=["api", "v2", "branch"],
  release="3.6"
)
```

---

## TASK-010 · DEV · Git push hook: проверка защиты ветки

**Роль**: DEV
**Инструменты**: `tracker-mcp`
**Приоритет**: P1 · #ПАО · блокирует TASK-005

### Что сделать

```
tracker-mcp.create_task(
  title="[DEV] Branch protection: git push hook — блокировка прямого и форс пуша",
  description=@plan.md#push-logic,
  node="API / v2 / Репозитории / Branch protection",
  lv=6,
  tags=["api", "v2", "branch", "ПАО", "git"],
  release="3.6"
)
```

---

## Статус задач

| Task | Роль | Приоритет | Статус | Блокирует |
|------|------|-----------|--------|-----------|
| TASK-001 | SA | P1 | pending | TASK-003, TASK-004 |
| TASK-002 | QA | P1 · #ПАО | pending | — |
| TASK-003 | QA | P1 · #ПАО | pending | — |
| TASK-004 | QA | P1 · #ПАО | pending | — |
| TASK-005 | QA | P1 · #ПАО | pending | — |
| TASK-006 | QA | P2 | pending | — |
| TASK-007 | QA | P1 | pending | — |
| TASK-008 | DEV | P1 | pending | TASK-002..005 |
| TASK-009 | DEV | P1 | pending | TASK-008 |
| TASK-010 | DEV | P1 · #ПАО | pending | TASK-005 |
