# OpenSpec: схема изменений и артефактов

## Что такое openspec

**openspec** — внешний CLI-инструмент (`~/.npm-global/bin/openspec`), который управляет процессом создания артефактов для каждого изменения продукта.

Vault содержит:
- `openspec/schemas/vcs/schema.yaml` — схема артефактов для продукта vcs
- `openspec/config.yaml` — скиллы/правила для каждого артефакта (генерируется из `vault/skills/`)
- `openspec/changes/<change-name>/` — директория каждого изменения

---

## Схема артефактов (schema.yaml)

Для продукта vcs определены **7 последовательных артефактов** + финальная стадия `apply`:

| Артефакт | Файл | Описание | Зависит от |
|----------|------|----------|-----------|
| `proposal` | `sa/proposal.md` | Бизнес-намерение: зачем, для кого, scope | — |
| `sa-specs` | `sa/specs/**/*.md` | Delta-спеки требований (ADDED/MODIFIED/REMOVED) | proposal |
| `be-design` | `be/design.md` | Технический подход BE: flow, DTO, error handling | proposal, sa-specs |
| `fe-design` | `fe/design.md` | UI/UX подход FE: компоненты, состояния, API-интеграция | proposal, sa-specs |
| `qa-plan` | `qa/test-plan.md` | Тест-план: сценарии, #ПАО-узлы, gate релиза | sa-specs |
| `qaa-tasks` | `qaa/tasks.md` | Чеклист автоматизации: e2e, integration, contract | qa-plan, be-design |
| `be-tasks` | `be/tasks.md` | Чеклист реализации бэкенда | be-design, qa-plan |
| `apply` | — | Финальная реализация по всем чеклистам | be-tasks, fe-tasks |

Статусы артефакта: `ready` → `done` / `blocked` (не выполнены зависимости).

---

## Директория изменения

Каждое изменение создаётся в `openspec/changes/<change-name>/`:

```
openspec/changes/vcs-10012-add-reactions/
├── .openspec.yaml            # Метаданные: schema, created date
├── sa/
│   ├── proposal.md           # Артефакт proposal
│   └── specs/
│       └── feature-name/
│           └── spec.md       # Артефакт sa-specs (один файл на capability)
├── be/
│   ├── design.md             # Артефакт be-design
│   └── tasks.md              # Артефакт be-tasks
├── fe/
│   ├── design.md             # Артефакт fe-design
│   └── tasks.md              # Артефакт fe-tasks (schema.yaml: fe-tasks)
├── qa/
│   └── test-plan.md          # Артефакт qa-plan
├── qaa/
│   └── tasks.md              # Артефакт qaa-tasks
└── .openspec-flow/           # Служебные файлы flow (генерируется при make openspec-flow)
    ├── flow.state            # Текущая стадия flow
    ├── status.latest.json    # Последний статус артефактов
    ├── instructions/         # JSON-инструкции для каждого артефакта
    │   ├── proposal.json
    │   ├── sa-specs.json
    │   └── ...
    ├── prompts/              # Markdown-версии инструкций (готовые промпты)
    │   ├── proposal.prompt.md
    │   └── ...
    └── status/               # История статусов по timestamp
```

---

## Ключевые команды

```bash
# Создать новое изменение
make openspec-new CHANGE=vcs-10012-add-reactions

# Статус артефактов изменения
make openspec-status CHANGE=vcs-10012-add-reactions

# Получить инструкции для конкретного артефакта
make openspec-instructions CHANGE=vcs-10012-add-reactions ARTIFACT=proposal

# Список активных изменений
make openspec-list

# Архивировать завершённое изменение
make openspec-archive CHANGE=vcs-10012-add-reactions
```

---

## One-command flow

```bash
make openspec-flow CHANGE=vcs-10012-add-reactions
```

Автоматизирует весь цикл:

1. Пересобирает `openspec/config.yaml` из `vault/skills/` (AUTO_SYNC=1 по умолчанию)
2. Валидирует схему vcs
3. Создаёт директорию изменения (если не существует)
4. Последовательно проходит все артефакты в порядке: `proposal → sa-specs → be-design → fe-design → qa-plan → qaa-tasks → be-tasks`
5. Для каждого артефакта: генерирует JSON-инструкцию + Markdown-промпт → ждёт выполнения → переходит к следующему
6. Проверяет gate apply (все зависимости выполнены)
7. Генерирует инструкцию apply
8. Предлагает архивировать изменение (confirm-gate)

Параметры:
```bash
# Отключить автоматическую пересборку config
make openspec-flow CHANGE=... AUTO_SYNC=0

# Продолжить прерванный flow
make openspec-flow-resume CHANGE=...

# Автоматически пройти archive-gate
make openspec-flow CHANGE=... AUTO_ARCHIVE=1

# Кастомная директория state
make openspec-flow CHANGE=... FLOW_STATE_DIR=.my-state
```

Flow сохраняет текущее состояние в `flow.state` — при падении или паузе можно продолжить через `openspec-flow-resume`.

---

## Формат proposal.md (артефакт SA)

```markdown
# Daily Intent Contract

## Intent
Что изменяется и для кого

## Why Now
Почему это важно именно сейчас (метрики, боли)

## Target Audience
Конкретная целевая аудитория

## Expected Outcome
Что должно измениться после реализации

## Success Metrics
Измеримые критерии успеха

## Key Hypothesis
Проверяемое предположение

## What Changes
- Список изменений (breaking changes помечать **BREAKING**)

## Capabilities
### New Capabilities
- `capability-name`: описание (создаёт sa/specs/capability-name/spec.md)
### Modified Capabilities
- ...

## Impact
- OpenAPI paths, сервисы, зависимости

## Risks
- Технические и продуктовые риски
```

---

## Формат sa-specs (delta-требования)

Файл `sa/specs/<capability-name>/spec.md`. Каждое требование:

```markdown
### REQ-XXX: <название>
**Узел**: <путь в test-model>
**Уровень**: lv<N>
**Теги**: #...
**Версия API**: <v1/v2/v3/web1/web2>
**Компонент**: <UI/API/CLI>

Система SHALL <описание поведения>.

#### Scenario: <название>
- **WHEN** <условие>
- **THEN** <результат>
```

Разделы: `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`.

---

## Связь с vault/skills/

При каждом запуске `openspec-flow` (если AUTO_SYNC=1) пересобирается `openspec/config.yaml` из `vault/skills/`:

- Изменение скиллов сразу попадает в следующий запуск flow
- `config.yaml` — артефакт сборки, не источник правды
- Источник правды для скиллов — файлы в `vault/skills/`
