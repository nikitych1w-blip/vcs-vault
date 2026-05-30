# Context Builder: Подробная спецификация

> Компонент внутри vcs-vault. Собирает нужный контекст перед каждой сессией Claude Code: выбирает роль, фильтрует знания, проверяет актуальность, формирует промпт.

---

## Место в архитектуре

```
test-model ──┐
skills      ──┼──→ [ Context Builder ] ──→ Claude Code ──→ MCP-инструменты
knowledges  ──┤
mcp/INDEX   ──┘
```

Context Builder — не монолит. Это конвейер из 5 шагов, каждый из которых принимает накопленный контекст и дополняет его.

---

## Входные параметры

| Параметр | Тип | Описание | Пример |
|----------|-----|----------|--------|
| `role` | enum | Роль агента | `sa` / `qa` / `po` / `dev` / `auto` |
| `scope.interface` | string[] | Интерфейс(ы) продукта | `["UI", "api"]` |
| `scope.entity` | string[] | Сущности | `["repo", "branch", "merge"]` |
| `scope.lv_min` | int | Минимальный уровень lv | `6` |
| `scope.lv_max` | int | Максимальный уровень lv | `8` |
| `scope.tags` | string[] | Обязательные теги | `["ПАО"]` |
| `intent` | enum | Цель сессии | `write-tc` / `analyze` / `gate-check` / `bug-report` / `write-spec` |
| `release` | string? | Контекст релиза | `"3.5"` |
| `freshness_check` | bool | Проверять актуальность знаний | `true` |

---

## Конвейер обработки

### Шаг 1 — Role Resolver

Загружает файлы роли и общий контекст продукта.

```
role = "qa"

→ загрузить: skills/qa/role.md
→ загрузить: skills/common/product.md
→ загрузить: skills/common/model.md

Если role = "sa":  загрузить skills/sa/role.md
Если role = "po":  загрузить только common/ (нет отдельного файла)
Если role = "dev": загрузить common/ + выжимку API-контрактов из knowledges
Если role = "auto": загрузить skills/qa/role.md + фокус на lv7-lv8 + acceptance criteria
```

**Выход:** `{system_prompt: "...", role_constraints: [...], artifact_formats: {...}}`

---

### Шаг 2 — Scope Filter

Фильтрует дерево test-model до нужного подмножества узлов.

```
scope = { interface: ["UI"], entity: ["repo", "branch"], lv_min: 6, lv_max: 8, tags: ["ПАО"] }

→ filesystem-mcp.list_nodes(
    tags_required=["UI", "branch", "ПАО"],
    lv_range=[6, 8]
  )
  → 14 узлов

→ из 14 узлов отобрать:
    covered:  8  (передать как "уже покрыто, не дублировать")
    partial:  4  (передать как "покрыто частично, доработать")
    missing:  2  (передать как "приоритет — писать первыми")
```

**Выход:** `{nodes: [...], priority_nodes: [...], covered_summary: "8/14"}`

Если `scope` не задан — загружается полный INDEX.md как навигационный контекст.

---

### Шаг 3 — Knowledge Selector

Из `knowledges/` выбирает только релевантные разделы, а не весь корпус.

```
Правила выбора по role + scope:

role=qa, entity=[branch]:
  → knowledges/gitea/docs/usage/repository/git-branches.md
  → knowledges/git/en/03-git-branching/*.md (выжимка)

role=sa, interface=[api], version=[v2]:
  → knowledges/sourcecontrol/  (все файлы)
  → knowledges/gitea/docs/development/api-usage.md

role=dev, entity=[merge]:
  → knowledges/gitea/docs/usage/issues-prs/*.md
  → knowledges/git/en/05-distributed-git/*.md

intent=gate-check:
  → только test-model узлы с #ПАО, без knowledges
  → mcp/INDEX.md (чтобы знать какие инструменты доступны для отчёта)
```

**Выход:** `{knowledge_excerpts: [...], file_references: [...]}`

---

### Шаг 4 — Freshness Check

Проверяет, насколько свежи знания в vault.

```
Источник              Файл-маркер                 TTL
─────────────────────────────────────────────────────
Sbertrack Wiki        .sync-meta/sbertrack.json   7 дней
SourceControl API     .sync-meta/sc.json          1 день
Gitea docs            .sync-meta/gitea.json       30 дней
Git book              .sync-meta/git-book.json    90 дней
TMS статусы           .sync-meta/tms.json         1 день
CI coverage           .sync-meta/ci.json          1 час

Если TTL истёк:
  → предупреждение в начале сессии:
    "⚠ knowledges/wiki/ устарели (последнее обновление: 12 дней назад).
     Запустить sbertrack-sync перед работой? [да / продолжить]"
```

**Выход:** `{warnings: [...], stale_sources: [...]}`

---

### Шаг 5 — Context Assembler

Собирает всё в единый структурированный промпт для передачи в Claude Code.

```
assembled_context = {
  system_prompt:   role_prompt + product_context + model_context,
  scope_summary:   "UI / Репозиторий / Ветки, lv6–lv8, #ПАО (14 узлов)",
  priority_nodes:  [узлы с status:missing + #ПАО],
  knowledge_refs:  [@file1, @file2, ...],
  active_tools:    [sc-mcp, tms-mcp, filesystem-mcp],
  warnings:        ["⚠ wiki устарели 12 дней"],
  session_intent:  "write-tc"
}
```

**Выход:** финальный блок контекста, готовый к загрузке в сессию.

---

## Выходные данные: структура промпта

```
──────────────────────────────────────────────────────
SYSTEM CONTEXT (собирается Context Builder)
──────────────────────────────────────────────────────

[РОЛЬ]
{содержимое skills/qa/role.md}

[ПРОДУКТ]
{содержимое skills/common/product.md}

[СИСТЕМА КООРДИНАТ]
{содержимое skills/common/model.md}

[СКОУП СЕССИИ]
Интерфейс: UI
Сущности: repo, branch
Уровни: lv6–lv8
Теги: #ПАО
Узлов в скоупе: 14 (covered: 8, partial: 4, missing: 2)

[ПРИОРИТЕТНЫЕ УЗЛЫ (missing + #ПАО)]
• UI / Проект / Репозиторий / Код / Ветки / Название / По символам  lv8
• UI / Проект / Репозиторий / Код / Ветки / Удаление / Чужая        lv7

[ЗНАНИЯ]
@knowledges/gitea/docs/usage/repository/git-branches.md
@knowledges/git/en/03-git-branching/01-chapter3.md

[ДОСТУПНЫЕ ИНСТРУМЕНТЫ]
• tms-mcp    — создать/обновить TC
• sc-mcp     — создать ветку/MR
• filesystem-mcp — обновить статус узла

[ПРЕДУПРЕЖДЕНИЯ]
⚠ knowledges/wiki/ не обновлялись 12 дней

[ЦЕЛЬ СЕССИИ]
write-tc — написать тест-кейсы для приоритетных узлов
──────────────────────────────────────────────────────
```

---

## Реализация в Claude Code

Context Builder реализуется через три механизма:

### 1. CLAUDE.md — базовый контекст (всегда загружается)

```markdown
# vcs-vault

Этот vault — база знаний команды SourceControl.

@skills/common/product.md
@skills/common/model.md
@mcp/INDEX.md

Правила:
- Каждый артефакт требует координаты: путь + lv + теги
- Deprecated-узлы (пометка "удалить раздел") — не трогать
- #ПАО + status:missing → блокирует релиз
```

### 2. `/commands` — переключение роли и скоупа

```
.claude/commands/
├── role-sa.md       # активировать роль SA
├── role-qa.md       # активировать роль QA
├── role-dev.md      # активировать роль разработчика
├── scope-ui.md      # сфокусировать на UI-узлах
├── scope-api.md     # сфокусировать на API-узлах
├── scope-pao.md     # только #ПАО узлы
├── gate-check.md    # проверка готовности к релизу
└── sync-check.md    # проверить актуальность знаний
```

Пример `.claude/commands/role-qa.md`:

```markdown
---
description: Активировать роль тестировщика (QA)
---

Загрузи контекст QA:
@skills/qa/role.md
@skills/common/product.md
@skills/common/model.md

Ты работаешь как QA. Используй форматы из role.md.
Каждый TC и дефект-репорт обязан содержать координату узла (путь + lv + теги).
```

Пример `.claude/commands/scope-pao.md`:

```markdown
---
description: Показать все #ПАО узлы без покрытия
---

Запусти: filesystem-mcp.list_missing_pao()

Сгруппируй по интерфейсу (UI / api / CLI) и по уровню (lv6 / lv7 / lv8).
Выведи таблицу: узел | lv | статус | tms_id.
```

### 3. `.sync-meta/` — файлы актуальности адаптеров

```json
// .sync-meta/sbertrack.json
{
  "last_sync": "2026-04-20T14:30:00Z",
  "space": "SC",
  "pages_synced": 47,
  "adapter": "sbertrack-sync"
}
```

Context Builder читает эти файлы и при TTL > порога добавляет предупреждение в начало сессии.

---

## Примеры собранного контекста по роли

### PO — gate-check

```
Роль: —  (нет ролевого промпта, только продуктовый контекст)
Скоуп: все #ПАО узлы, все интерфейсы
Знания: не загружаются
Инструменты: filesystem-mcp, tms-mcp, notifications-mcp
Цель: одна команда → статус релиза
```

### SA — write-spec, scope=api/v2

```
Роль: skills/sa/role.md
Скоуп: API v2, lv4–lv8
Знания: knowledges/sourcecontrol/ + knowledges/gitea/docs/development/api-usage.md
Инструменты: wiki-mcp, tracker-mcp, filesystem-mcp
Цель: декомпозировать фичу в узлы + написать API-контракт
```

### QA — write-tc, scope=UI/branch/ПАО

```
Роль: skills/qa/role.md
Скоуп: UI, entity=[branch], lv6–lv8, tags=[ПАО]
Знания: knowledges/gitea/docs/usage/repository/git-branches.md
Инструменты: tms-mcp, filesystem-mcp
Цель: сгенерировать TC для узлов с status:missing
```

### Разработчик — analyze, task=SC-2341

```
Роль: common/product.md + выжимка API-контракта
Скоуп: один узел (из задачи SC-2341)
Знания: конкретный API-контракт из knowledges/sourcecontrol/ + wiki-mcp.get_page
Инструменты: sc-mcp, tracker-mcp, git-mcp
Цель: получить ТЗ с API-контрактом и edge cases
```

### Автоматизатор — write-test, source=TC-4521

```
Роль: skills/qa/role.md (QA-роль как база)
Скоуп: один узел из TC
Знания: acceptance criteria из spec.md (если есть) + knowledges
Инструменты: tms-mcp, sc-mcp, git-mcp, playwright-mcp
Цель: сгенерировать скелет автотеста + ветку в vcs-playwright
```

---

## Параметры сессии: быстрый старт

Минимальный вызов через команду:

```bash
# Запустить QA-сессию по UI-веткам, приоритет #ПАО
/role-qa
/scope-pao

# Или комбинированно через CLAUDE.md custom command:
/qa-gate-check release=3.5
```

Полный вызов через параметры (программный API):

```json
{
  "role": "qa",
  "scope": {
    "interface": ["UI"],
    "entity": ["branch", "commit"],
    "lv_min": 7,
    "lv_max": 8,
    "tags": ["ПАО"]
  },
  "intent": "write-tc",
  "release": "3.5",
  "freshness_check": true
}
```

---

## Расширяемость

Context Builder спроектирован так, чтобы новые источники знаний добавлялись без изменения ядра:

1. Новый адаптер → добавить запись в `mcp/INDEX.md` + `sync-meta/` файл
2. Новая роль → добавить `skills/{role}/role.md` + команду `.claude/commands/role-{name}.md`
3. Новый тип скоупа → расширить логику Knowledge Selector (Шаг 3)
4. Новый тип намерения (intent) → добавить шаблон выходного промпта в Assembler (Шаг 5)
