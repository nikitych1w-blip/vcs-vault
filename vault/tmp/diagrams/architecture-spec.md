# vcs-vault: Архитектурная спецификация

> Документ для передачи в разработку. Описывает концепцию, компоненты системы, спецификации MCP-серверов, роль spec-kit и обоснование выбора Obsidian.

---

## 1. Концепция

Система построена по метафоре **мозг + руки**:

- **Мозг** — `vcs-vault`. Хранит знание: что такое продукт, как он устроен, какие сущности существуют, как работать с ними в роли SA и QA. Это статичный, структурированный контекст.
- **Руки** — MCP-серверы. Инструменты, через которые мозг действует: читает и пишет в реальные системы — трекер, wiki, TMS, репозитории, браузер.
- **Проводник** — Claude Code. AI-агент, загружающий мозг как контекст и управляющий руками через MCP-протокол.

```
vcs-vault (context)
    └── Claude Code (agent)
            ├── sc-mcp         → SourceControl API
            ├── tms-mcp        → Sbertrack TMS
            ├── wiki-mcp       → Sbertrack Wiki
            ├── tracker-mcp    → Sbertrack TaskTracker
            ├── notifications-mcp → СберЧат
            ├── filesystem-mcp → локальный vault
            ├── git-mcp        → git операции
            └── playwright-mcp → браузер
```

---

## 2. Компоненты мозга (vcs-vault)

### 2.1 test-model

Иерархическая модель продукта `lv0–lv8`. Каждый узел — `.md`-файл с frontmatter:

```yaml
---
tags: [SC, lv7, UI, FE, repo, branch]
status: missing        # covered | partial | missing
tms: TC-1234           # ссылка на TMS
pao: true              # приоритетное покрытие
---
```

**Функция в системе:** единственный source of truth о том, что вообще существует в продукте. Все артефакты (TC, требования, баги, задачи) координируются через узел этой модели.

**Формат координаты:** `UI / Проект / Репозиторий / Код / Ветки / Создание` + `lv7` + `[#UI, #SC, #branch, #ПАО]`

### 2.2 skills

Ролевые промпты для Claude Code:

| Файл | Содержимое |
|------|------------|
| `common/product.md` | Продукт, интерфейсы, версии API, сущности, deprecated |
| `common/model.md` | Система координат: уровни, теги, карта сущностей |
| `sa/role.md` | Роль SA: форматы требований, API-контрактов, принципы |
| `qa/role.md` | Роль QA: TC, дефект-репорты, lifecycle покрытия, gate перед релизом |

**Функция в системе:** определяет, как Claude Code рассуждает и в каком формате генерирует артефакты при активации той или иной роли.

### 2.3 knowledges

Техническая документация как референс:

| Источник | Путь | Обновление |
|----------|------|------------|
| Gitea docs (git submodule) | `knowledges/gitea/` | `./scripts/update-gitea.sh` |
| Pro Git book | `knowledges/git/en/` | `./scripts/update-git.sh` |
| SourceControl product docs | `knowledges/sourcecontrol/` | вручную |
| Sbertrack wiki (PDF→MD) | `knowledges/wiki/<space>/` | `download-wiki.sh` + `convert-wiki.sh` |

### 2.4 mcp/INDEX.md

Реестр подключённых MCP-серверов с метаданными. Является декларацией: какие руки доступны мозгу.

---

## 3. MCP-слой: спецификация серверов

> Все корпоративные системы работают на одной платформе — **Sbertrack** (`portal.works.prod.sbt/swtr`, API spec: `api.yaml`). Сервера TMS, wiki, tracker — это отдельные плагины одного API.

### 3.1 sc-mcp — SourceControl

**Назначение:** CRUD-операции на Gitea-based платформе SourceControl.

**API-основа:** Gitea REST API (документация в `knowledges/gitea/`).

| Инструмент | Описание |
|------------|---------|
| `list_projects` | Получить список проектов |
| `list_repos` | Репозитории проекта |
| `get_repo` | Метаданные репозитория |
| `list_branches` | Ветки репозитория |
| `create_branch` | Создать ветку |
| `list_merge_requests` | Открытые MR |
| `create_merge_request` | Создать MR |
| `get_merge_request` | Получить MR с диффом |
| `merge` | Слить MR |
| `create_webhook` | Установить вебхук |
| `get_file` | Получить содержимое файла |
| `commit_file` | Закоммитить файл |

**Use cases:**
- SA создаёт MR с требованием привязанным к узлу test-model
- QA открывает MR для TC-файлов
- Автоматизация: при изменении узла `status: missing` → создать задачу в tracker

**Auth:** Bearer token / access-token.

**Приоритет реализации:** P1 (ядро системы).

---

### 3.2 tms-mcp — TestCulture / Sbertrack TMS

**Назначение:** Управление тест-кейсами, прогонами и статусами покрытия в TMS.

**API-основа:** `swtr_tms_plugin` эндпоинты в `api.yaml`:
```
POST /extension/plugin/v2/rest/api/swtr_tms_plugin/v1/run/create
```

| Инструмент | Описание |
|------------|---------|
| `create_test_case` | Создать TC с координатой узла |
| `update_test_case` | Обновить TC (шаги, статус) |
| `get_test_case` | Получить TC по ID |
| `list_test_cases` | Список TC по фильтру (узел, тег, статус) |
| `create_run` | Создать тест-прогон |
| `update_run_result` | Записать результат прогона |
| `get_coverage_report` | Отчёт покрытия по срезу |
| `link_tc_to_node` | Привязать TC к узлу test-model |

**Use cases:**
- QA: из узла test-model с `status: missing` → автогенерация шаблона TC → запись в TMS
- Обратно: при изменении TC в TMS → обновить `status` в узле vault (`filesystem-mcp`)
- Генерация отчёта покрытия перед релизом

**Auth:** Bearer token (Sbertrack).

**Приоритет:** P1.

---

### 3.3 wiki-mcp — Sbertrack Wiki

**Назначение:** Чтение и запись документации в корпоративном wiki (sberwiki).

**API-основа:** `swtr_wiki_plugin` в `api.yaml`. Существующие скрипты: `download-wiki.sh`, `convert-wiki.sh`, `debug-wiki-api.sh`.

Актуальные эндпоинты из `api.yaml`:
```
POST /extension/plugin/v2/rest/api/swtr_wiki_plugin/v1/wiki/unit/hierarchy
GET  /extension/plugin/v2/rest/api/swtr_wiki_plugin/v2/wiki/unit/{unitCode}
POST /extension/plugin/v2/rest/api/swtr_wiki_plugin/v1/wiki/unit/{spaceCode}/{unitCode}/draw-io/create
POST /rest/api/export/v1                  — async PDF export
POST /rest/api/export/v1/list             — poll export status
GET  /rest/api/export/v1/download/{id}    — скачать файл
```

| Инструмент | Описание |
|------------|---------|
| `get_hierarchy` | Получить дерево страниц space |
| `get_page` | Содержимое страницы по unitCode |
| `search_pages` | Поиск по тексту / тегам |
| `create_page` | Создать страницу |
| `update_page` | Обновить содержимое |
| `export_to_pdf` | Async PDF-экспорт (flow из download-wiki.sh) |
| `sync_to_vault` | Скачать space → конвертировать в MD → записать в vault |

**Замечание:** `sync_to_vault` — обёртка над существующим pipeline `download-wiki.sh` + `convert-wiki.sh`. Логика уже написана, нужна только MCP-обёртка.

**Auth:** `Authorization: Bearer $SBERTRACK_TOKEN` + `Cookie: api_swtr_as21=true`.

**Приоритет:** P2.

---

### 3.4 tracker-mcp — Sbertrack TaskTracker

**Назначение:** Работа с задачами и багами в корпоративном трекере.

**API-основа:** `swtr_task_tracker_plugin` + Jira-compatible эндпоинты в `api.yaml`:
```
PUT  /extension/plugin/v2/rest/api/swtr_task_tracker_plugin/v1/version/update
GET  /extension/plugin/v2/rest/api/jira/rest/api/2/issue/{issueIdOrKey}
POST /extension/plugin/v2/rest/api/jira/rest/api/2/issue/{issueIdOrKey}/comment
```

| Инструмент | Описание |
|------------|---------|
| `create_task` | Создать задачу с координатой узла |
| `create_bug` | Создать дефект-репорт по формату QA role |
| `get_issue` | Получить задачу/баг |
| `update_status` | Перевести задачу по воркфлоу |
| `add_comment` | Добавить комментарий |
| `link_to_node` | Связать задачу с узлом test-model |
| `list_sprint` | Задачи текущего спринта |

**Use cases:**
- QA создаёт баг: заполняет поля из формата дефект-репорта (`qa/role.md`) автоматически
- SA создаёт задачи разработки из требований привязанных к узлам
- Автоматически закрывает `status: missing` узлы при закрытии соответствующих задач

**Auth:** Jira-compatible Bearer token через Sbertrack.

**Приоритет:** P2.

---

### 3.5 notifications-mcp — СберЧат

**Назначение:** Отправка уведомлений и отчётов команде.

| Инструмент | Описание |
|------------|---------|
| `send_message` | Отправить сообщение в канал / DM |
| `send_coverage_report` | Форматированный отчёт покрытия |
| `notify_release_blocker` | Алерт: `#ПАО` узлы с `status: missing` |
| `send_review_request` | Запрос на ревью TC или требования |

**Use cases:**
- Gate перед релизом: если `#ПАО` + `status: missing` → уведомление в канал команды
- Еженедельный отчёт покрытия по срезу

**Приоритет:** P3.

---

### 3.6 filesystem-mcp — File System

**Назначение:** Чтение и запись файлов непосредственно в vault.

| Инструмент | Описание |
|------------|---------|
| `read_node` | Прочитать узел test-model по пути |
| `update_node_status` | Обновить `status` в frontmatter узла |
| `write_tc` | Записать TC как `.md` файл в vault |
| `list_nodes_by_tag` | Узлы по тегу (аналог Dataview) |
| `list_missing_pao` | `#ПАО` узлы с `status: missing` |
| `write_report` | Записать отчёт покрытия |

**Use cases:**
- Двусторонняя синхронизация: TMS изменил TC → обновить status в vault
- Скрипт аудита покрытия: найти все `#ПАО` + `missing`, отдать в `notifications-mcp`

**Приоритет:** P1 (базовая связка с vault).

---

### 3.7 git-mcp — Git operations

**Назначение:** Git-операции в репозиториях SourceControl и самом vault.

| Инструмент | Описание |
|------------|---------|
| `clone` | Клонировать репозиторий |
| `status` | Статус рабочего дерева |
| `diff` | Diff изменений |
| `commit` | Зафиксировать изменения |
| `push` | Отправить в remote |
| `create_branch` | Создать ветку |
| `log` | История коммитов |
| `blame` | Построчная история файла |

**Use cases:**
- SA: зафиксировать обновления vault (требования, узлы) через git commit
- Автоматизация: при merge MR в SourceControl → обновить `status` связанного узла

**Приоритет:** P2.

---

### 3.8 playwright-mcp — Browser automation

**Назначение:** Управление браузером для UI-тестирования и валидации.

| Инструмент | Описание |
|------------|---------|
| `navigate` | Открыть URL |
| `click` | Нажать элемент (by selector / text) |
| `fill` | Заполнить поле |
| `screenshot` | Скриншот страницы / элемента |
| `assert_text` | Проверить наличие текста |
| `assert_element` | Проверить наличие элемента |
| `run_smoke` | Запустить smoke-сценарий по узлу lv5-6 |

**Use cases:**
- QA: быстрая валидация UI-сценария по узлу test-model перед написанием полного TC
- Регрессия: проверить узлы `#ПАО` перед релизом через браузер

**Приоритет:** P3.

---

## 4. spec-kit: роль в архитектуре

### Суть

[spec-kit](https://github.com/github/spec-kit) реализует **Spec-Driven Development (SDD)** — методологию, где спецификация является первичным артефактом, а код — производным от неё.

Ключевой принцип: **"Specifications don't serve code — code serves specifications."**

Инвертирует привычный порядок: не "пишем код и документируем постфактум", а "пишем спецификацию и генерируем код из неё".

### Что это даёт

spec-kit определяет pipeline из 6 шагов:

```
1. /speckit.constitution   — установить принципы проекта (однократно)
2. /speckit.specify        — превратить идею в spec.md (user stories + AC)
3. /speckit.clarify        — разрешить [NEEDS CLARIFICATION] в spec.md
4. /speckit.plan           — сгенерировать plan.md (архитектура, data model)
5. /speckit.tasks          — сгенерировать tasks.md (исполняемые задачи, test-first)
6. /speckit.implement      — выполнить tasks.md через AI
```

### Где vcs-vault сейчас и где gap

| Слой | vcs-vault (есть) | spec-kit (добавляет) |
|------|-----------------|---------------------|
| Знание | `test-model`, `skills`, `knowledges` | `.specify/memory/constitution.md` |
| Спецификация | узлы lv5–lv8 как концепции | `specs/NNN-feature/spec.md` с user stories и AC в формате Given/When/Then |
| Архитектурный план | артефакты SA в wiki | `specs/NNN-feature/plan.md` (data model, API contracts, architecture decisions) |
| Исполнение | ручное | `specs/NNN-feature/tasks.md` → `implement` → MCP-руки |

**Вывод:** vcs-vault закрывает слой знания и системы координат. spec-kit закрывает слой исполнения — от спецификации до кода. Вместе они образуют замкнутый цикл.

### Маппинг vcs-vault → spec-kit

```
skills/common/product.md  ──────────────────────┐
skills/common/model.md    ──────────────────────┴──→  .specify/memory/constitution.md

test-model / lv4–lv5 узлы ──────────────────────────→  specs/NNN-feature/ (папка)

test-model / lv6–lv7 узлы ──────────────────────────→  spec.md / user stories (P1/P2/P3)

test-model / lv7–lv8 узлы ──────────────────────────→  spec.md / acceptance criteria (Given/When/Then)

skills/sa/role.md ──────────────────────────────────→  шаблон для /speckit.specify + /speckit.plan

skills/qa/role.md ──────────────────────────────────→  шаблон для AC + test-first tasks в tasks.md

knowledges/ ─────────────────────────────────────── →  specs/NNN/research.md (техническая база)
```

### Что не нужно перекладывать

`status: covered/partial/missing` + `#ПАО` система покрытия — это уникальная ценность vcs-vault, которой нет в spec-kit. Сохранить как расширение frontmatter в `spec.md`:

```yaml
---
# spec-kit standard fields
status: approved
priority: P1

# vcs-vault extensions
node_path: "UI / Проект / Репозиторий / Код / Ветки"
lv: 7
pao: true
coverage_status: partial   # covered | partial | missing
tms_id: TC-1234
---
```

### Практический workflow с spec-kit + MCP-руками

```
Получили фичу → /speckit.specify
    → spec.md с user stories и AC (lv7-8 детализация)
/speckit.plan
    → plan.md (data model, API endpoints, UI flows)
/speckit.tasks
    → tasks.md (test-first: сначала TC, потом реализация)
/speckit.implement task-001
    → tms-mcp.create_test_case(...)
    → sc-mcp.create_branch(...)
    → filesystem-mcp.update_node_status(node, "covered")
    → tracker-mcp.create_task(...)
```

---

## 5. Почему Obsidian

### 5.1 Модель продукта — граф, не список

test-model — иерархическое дерево с перекрёстными связями (`[[fork]]` ссылается из нескольких узлов, аутентификация — shared между API и UI). Obsidian хранит это нативно через bidirectional links.

**Graph view** — визуальная навигация по иерархии: видно кластеры, изолированные узлы, узловые точки (высокий in-degree = важный узел).

### 5.2 Теги как оперативный интерфейс

**Tags panel** в Obsidian — прямой доступ к срезам:
- Нажал `#ПАО` → все приоритетные узлы
- Нажал `#UI` + `#branch` → все UI-сценарии про ветки
- Нажал `#lv8` → атомарные сценарии

Это работает без написания запросов — быстрый онбординг для нового члена команды.

### 5.3 Dataview — отчёты покрытия без кода

```dataview
TABLE tms, status, pao
FROM "knowledges/test-model"
WHERE status = "missing" AND contains(tags, "ПАО")
SORT file.path ASC
```

Живой отчёт "что блокирует релиз" прямо в vault. Без экспорта, без сторонних инструментов.

### 5.4 Frontmatter = структурированные данные

Каждый `.md` узел — это одновременно человекочитаемый документ и машиночитаемая запись. `filesystem-mcp` читает frontmatter напрямую, обновляет `status`, добавляет `tms_id`. Обычный файл, но с метаданными.

### 5.5 Markdown = git-friendly, нет vendor lock-in

Весь vault — текстовые файлы. Это значит:
- **git diff** показывает, что изменилось в модели
- **git blame** — кто и когда добавил узел
- Любой редактор читает файлы без Obsidian
- CI/CD может парсить frontmatter скриптами (уже есть в `scripts/`)
- Нет зависимости от SaaS-платформы с данными команды

### 5.6 Плагины как расширяемость

| Плагин | Польза |
|--------|--------|
| **Dataview** | SQL-запросы по frontmatter (отчёты покрытия) |
| **Git** | Синхронизация vault через git прямо из Obsidian |
| **Kanban** | Доска задач из узлов test-model |
| **Excalidraw** | Диаграммы прямо в vault |
| **Templater** | Шаблоны новых узлов с автозаполненным frontmatter |

### 5.7 Альтернативы и почему нет

| Альтернатива | Проблема |
|-------------|---------|
| Confluence | Нет нативного frontmatter, плохой git-export, платный |
| Notion | SaaS с данными команды в облаке, нет bidirectional links по графу |
| plain markdown в репо | Нет Graph view, нет Dataview, нет Tags panel — теряется ½ ценности |
| Roam Research | SaaS, дорого, нет offline-first |

---

## 6. Потоки данных

### Создание тест-кейса (QA)

```
1. Claude Code загружает context:
   skills/qa/role.md + skills/common/model.md + test-model/узел

2. Пользователь: "напиши TC для узла UI/Проект/Репо/Код/Ветки lv7"

3. Claude Code генерирует TC в формате qa/role.md

4. tms-mcp.create_test_case(tc) → TMS присваивает ID

5. filesystem-mcp.update_node_status(node_path, "covered", tms_id="TC-XXXX")

6. tracker-mcp.create_task("написать автотест TC-XXXX") — опционально
```

### Gate перед релизом

```
1. filesystem-mcp.list_missing_pao()
   → список узлов: #ПАО + status: missing/partial

2. Если список не пуст:
   → notifications-mcp.notify_release_blocker(список)
   → tracker-mcp.create_task для каждого gap

3. Если список пуст:
   → notifications-mcp.send_message("Релиз разрешён. Покрытие #ПАО: 100%")
```

### Синхронизация wiki → vault

```
1. wiki-mcp.sync_to_vault(space="SC")
   (внутри: download-wiki.sh + convert-wiki.sh pipeline)

2. filesystem-mcp.write_files(converted_md_files → knowledges/wiki/SC/)

3. git-mcp.commit("sync: wiki space SC → knowledges/wiki/SC")
```

---

## 7. Приоритет реализации

| # | MCP-сервер | Приоритет | Блокирует |
|---|-----------|-----------|---------|
| 1 | `filesystem-mcp` | P1 | связку vault ↔ всё остальное |
| 2 | `sc-mcp` | P1 | работу с SourceControl |
| 3 | `tms-mcp` | P1 | управление TC и покрытием |
| 4 | `wiki-mcp` | P2 | синхронизацию документации |
| 5 | `tracker-mcp` | P2 | создание задач/багов |
| 6 | `git-mcp` | P2 | автоматизацию коммитов |
| 7 | `notifications-mcp` | P3 | уведомления команды |
| 8 | `playwright-mcp` | P3 | UI автоматизацию |

**Минимальный рабочий контур (P1):** `filesystem-mcp` + `sc-mcp` + `tms-mcp` — позволяет читать vault, работать с SourceControl и управлять TC. Spec-kit pipeline работает уже на этом контуре.
