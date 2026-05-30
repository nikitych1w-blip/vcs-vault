---
feature_id: "001"
status: approved
depends_on: spec.md
release: "3.6"
---

# Plan: Защита веток репозитория

**Узел**: `UI / Проект / Репозитории / Репозиторий / Настройки / Защита веток` (lv6)

---

## Data Model

### BranchProtectionRule

```json
{
  "id": 42,
  "repo_id": 1337,
  "pattern": "main",
  "block_push": true,
  "block_force_push": true,
  "block_delete": true,
  "required_approvals": 2,
  "required_status_checks": ["CI/build", "CI/lint"],
  "created_at": "2026-04-26T10:00:00Z",
  "updated_at": "2026-04-26T10:00:00Z"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | int | Первичный ключ |
| `repo_id` | int | FK → Repository |
| `pattern` | string | Glob-паттерн ветки (уникален в репозитории) |
| `block_push` | bool | Запретить прямой пуш |
| `block_force_push` | bool | Запретить форс-пуш (включается вместе с block_push) |
| `block_delete` | bool | Запретить удаление ветки |
| `required_approvals` | int | Минимум одобрений (0 = не требуется) |
| `required_status_checks` | string[] | Контекст статус-чеков, которые должны быть passing |

---

## API Контракты

### GET /api/v2/repos/{owner}/{repo}/branch_protections

**Узел**: `API / v2 / Репозитории / Branch protection / Список`
**Теги**: `#api` `#v2` `#ПАО` `#branch`
**Аутентификация**: access-token / JWT

#### Параметры запроса

| Параметр | Тип | Обязательный | Описание |
|----------|-----|-------------|----------|
| `owner` | string | да | Логин владельца репозитория |
| `repo` | string | да | Имя репозитория |

#### Успешный ответ (200)

```json
[
  {
    "id": 42,
    "pattern": "main",
    "block_push": true,
    "block_force_push": true,
    "block_delete": true,
    "required_approvals": 2,
    "required_status_checks": ["CI/build"]
  }
]
```

#### Коды ошибок

| Код | Условие |
|-----|---------|
| 401 | Не аутентифицирован |
| 403 | Нет прав администратора |
| 404 | Репозиторий не найден |

---

### POST /api/v2/repos/{owner}/{repo}/branch_protections

**Узел**: `API / v2 / Репозитории / Branch protection / Создание`
**Теги**: `#api` `#v2` `#ПАО` `#branch`
**Аутентификация**: access-token / JWT

#### Тело запроса

```json
{
  "pattern": "main",
  "block_push": true,
  "block_force_push": true,
  "block_delete": false,
  "required_approvals": 2,
  "required_status_checks": ["CI/build"]
}
```

#### Успешный ответ (201)

```json
{
  "id": 42,
  "pattern": "main",
  "block_push": true,
  "block_force_push": true,
  "block_delete": false,
  "required_approvals": 2,
  "required_status_checks": ["CI/build"],
  "created_at": "2026-04-26T10:00:00Z"
}
```

#### Коды ошибок

| Код | Условие |
|-----|---------|
| 400 | Невалидный паттерн или отсутствуют обязательные поля |
| 401 | Не аутентифицирован |
| 403 | Нет прав администратора |
| 404 | Репозиторий не найден |
| 409 | Правило с таким паттерном уже существует |

---

### PATCH /api/v2/repos/{owner}/{repo}/branch_protections/{id}

**Узел**: `API / v2 / Репозитории / Branch protection / Обновление`
**Теги**: `#api` `#v2` `#branch`
**Аутентификация**: access-token / JWT

#### Тело запроса (все поля опциональны кроме одного)

```json
{
  "block_push": true,
  "required_approvals": 3,
  "required_status_checks": ["CI/build", "CI/lint"]
}
```

**Ограничение**: поле `pattern` не принимается (422 Unprocessable Entity).

#### Успешный ответ (200)

Обновлённый объект BranchProtectionRule.

#### Коды ошибок

| Код | Условие |
|-----|---------|
| 400 | Тело запроса содержит `pattern` |
| 401 | Не аутентифицирован |
| 403 | Нет прав администратора |
| 404 | Правило или репозиторий не найдены |
| 422 | Попытка изменить паттерн |

---

### DELETE /api/v2/repos/{owner}/{repo}/branch_protections/{id}

**Узел**: `API / v2 / Репозитории / Branch protection / Удаление`
**Теги**: `#api` `#v2` `#branch`
**Аутентификация**: access-token / JWT

#### Успешный ответ (204)

Тело пустое.

#### Коды ошибок

| Код | Условие |
|-----|---------|
| 401 | Не аутентифицирован |
| 403 | Нет прав администратора |
| 404 | Правило или репозиторий не найдены |

---

## UI Flow

### Страница настроек: Защита веток

```
Настройки репозитория
└── Защита веток                        ← active tab
    ├── [+ Добавить правило]            ← кнопка, открывает модальное окно
    └── Список правил:
        ┌─────────────────────────────────────────────┐
        │ main          [Прямой пуш ✗] [Force ✗] [2👤] │  [Изменить] [Удалить]
        │ release/*     [Прямой пуш ✗]                 │  [Изменить] [Удалить]
        └─────────────────────────────────────────────┘
```

### Модальное окно: Создание / редактирование правила

```
┌─────────────────────────────────────┐
│ Добавить правило защиты ветки       │
├─────────────────────────────────────┤
│ Паттерн ветки *                     │
│ [main                             ] │
│                                     │
│ Ограничения                         │
│ [x] Запретить прямой пуш            │
│ [x]   Запретить форс-пуш            │
│ [ ] Запретить удаление ветки        │
│                                     │
│ Требования к слиянию                │
│ Минимум одобрений: [2]              │
│ Статус-чеки: [CI/build        ] [+] │
│                                     │
│ [Отмена]              [Сохранить]   │
└─────────────────────────────────────┘
```

**Логика UI**: чекбокс «Запретить форс-пуш» доступен только при включённом «Запретить прямой пуш».

---

## Логика обработки пуша

```
git push origin main
    │
    ▼
SourceControl: получить правила для ветки «main»
    │
    ├── BranchProtectionRule найдено
    │       │
    │       ├── block_push = true → reject 403, message: "Branch is protected"
    │       ├── block_force_push = true + force flag → reject 403
    │       └── block_delete = true + delete ref → reject 403
    │
    └── Правило не найдено → пуш разрешён
```

---

## Логика слияния MR

```
Попытка слить MR в «main»
    │
    ▼
Получить активные правила для целевой ветки
    │
    ├── required_approvals > 0
    │       └── COUNT(approvals WHERE state=approved) < required_approvals → blocked
    │
    ├── required_status_checks не пустой
    │       └── ANY(check NOT IN passing) → blocked
    │
    └── Все условия выполнены → слияние разрешено
```

---

## Зависимости

| Компонент | Зависимость | Тип |
|-----------|-------------|-----|
| Git push hook | BranchProtectionService | внутренняя |
| MR merge gate | BranchProtectionService | внутренняя |
| Status checks | CI/CD integration (Pipeliner) | внешняя `#pipeline` |
| Уведомления | notifications-mcp → СберЧат | внешняя |

---

## Открытые вопросы (из spec.md)

- Bypass list: в v1 реализации не планируется. Отдельная задача.
- Наследование на форки: правила не наследуются на форки (изолированный репозиторий).
- Паттерн `*`: поддерживается, применяется ко всем веткам.
