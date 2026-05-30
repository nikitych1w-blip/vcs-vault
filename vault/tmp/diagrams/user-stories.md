# User Stories: vcs-vault + MCP система

> Описание сценариев использования для каждой роли команды.
> Система: vcs-vault (мозг) + Claude Code (агент) + MCP-серверы (руки).

---

## Обозначения

- **Контекст** — что загружено в Claude Code перед сессией
- **Инструменты** — MCP-серверы, задействованные в сценарии
- **Артефакт** — что создаётся на выходе

---

---

# PO — Product Owner

## Контекст роли

Отвечает за ценность продукта. Не пишет ни код, ни тест-кейсы, но принимает решение: выпускать релиз или нет, брать ли фичу в спринт, куда направить ресурс команды. Нуждается в коротком, точном ответе на вопрос "что сейчас происходит с продуктом".

---

### US-PO-1: Готовность к релизу

> Как PO, я хочу одной командой получить статус готовности к релизу по всем приоритетным областям, чтобы принять решение о выпуске без ручного сбора данных из TMS, трекера и wiki.

**Контекст:** `common/product.md` + `common/model.md`

**Инструменты:** `filesystem-mcp`, `tms-mcp`, `notifications-mcp`

**Предусловие:** узлы test-model обновлены командой после спринта.

**Сценарий:**
```
Пользователь: "Готов ли релиз? Покажи статус #ПАО покрытия."

filesystem-mcp.list_missing_pao()
  → [
      "UI / Проект / Репозиторий / MR / Этапы",   lv7, missing
      "API v2 / Репозиторий / Создание",           lv6, partial
    ]

tms-mcp.get_coverage_report(filter="#ПАО")
  → covered: 34/36 (94%), missing: 2, partial: 1

Claude Code:
  "Релиз НЕ готов. 2 узла #ПАО со статусом missing,
   1 — partial. Блокеры:
   • UI / Проект / Репозиторий / MR / Этапы — TC отсутствуют
   • API v2 / Репозиторий / Создание — TC написаны частично
   Рекомендация: назначить QA на закрытие gap до конца дня."

notifications-mcp.send_message(channel="#releases", report)
```

**Артефакт:** краткий отчёт в чате + список блокеров с именами узлов.

---

### US-PO-2: Ввод новой фичи в работу

> Как PO, я хочу описать фичу одним абзацем и получить структурированный черновик spec.md, чтобы SA и QA могли сразу приступить к работе без долгого брифинга.

**Контекст:** `skills/common/product.md` + spec-kit constitution

**Инструменты:** `filesystem-mcp`, `wiki-mcp`, `tracker-mcp`

**Сценарий:**
```
Пользователь:
  "Нужна возможность массового переименования веток
   по шаблону через UI. Приоритет — P1, релиз через 3 спринта."

/speckit.specify →
  spec.md сгенерирован:
    - User Story P1: batch rename
    - Acceptance Criteria (Given/When/Then) на lv7-lv8
    - Узлы test-model: UI / Проект / Репозиторий / Код / Ветки / [lv6–lv8]
    - [NEEDS CLARIFICATION]: максимальное число веток в batch?

filesystem-mcp.write_file("specs/042-batch-rename/spec.md")

tracker-mcp.create_task(
  title="[SA] Spec: массовое переименование веток",
  link_to_spec="specs/042-batch-rename/spec.md"
)

wiki-mcp.create_page(space="SC", title="Фича: batch rename", content=spec)
```

**Артефакт:** `spec.md` в vault + задача SA в трекере + черновик страницы в wiki.

---

### US-PO-3: Срез по интерфейсу для стейкхолдера

> Как PO, я хочу получить отчёт по покрытию конкретного интерфейса (например, API v2 #ПАО) в виде таблицы, чтобы отправить его архитектору или заказчику.

**Инструменты:** `filesystem-mcp`, `tms-mcp`

**Сценарий:**
```
Пользователь: "Сделай отчёт по API v2 для ПАО-аудита."

filesystem-mcp.list_nodes_by_tag(tags=["v2", "ПАО"])
tms-mcp.get_coverage_report(filter="v2+ПАО")

Claude Code генерирует таблицу:
| Уровень | Всего | covered | partial | missing | % |
| lv6     |  12   |   10    |    1    |    1    |83%|
| lv7     |  34   |   29    |    3    |    2    |85%|
| lv8     |  18   |   14    |    2    |    2    |78%|

Приоритетные gap-ы:
• API v2 / Репозиторий / Webhook / Создание — lv7, missing
• API v2 / Аутентификация / JWT / Refresh — lv8, partial
```

**Артефакт:** готовая таблица для вставки в презентацию или wiki-страницу.

---

---

# IT Lead

## Контекст роли

Отвечает за техническую архитектуру и качество инженерных процессов. Следит, чтобы команда работала согласованно: требования — в одном формате, тест-модель — актуальна, новые люди — быстро входят в контекст. Ему важна предсказуемость и управляемость.

---

### US-LEAD-1: Онбординг нового члена команды

> Как IT Lead, я хочу, чтобы новый разработчик или тестировщик мог получить ответ на любой вопрос о продукте через Claude Code в первый день, не отвлекая коллег.

**Контекст:** все `skills/common/` + `knowledges/`

**Инструменты:** `filesystem-mcp`

**Сценарий:**
```
Новый сотрудник: "Что такое SourceControl? Какие интерфейсы есть?"
→ Claude Code отвечает из common/product.md

"Как устроена иерархия тест-модели? Что такое lv8?"
→ Claude Code объясняет из common/model.md

"Покажи все сущности API v2, которые нужно тестировать."
→ filesystem-mcp.list_nodes_by_tag(["v2"])
  → 47 узлов, сгруппированных по lv

"Где искать deprecated функциональность?"
→ Claude Code: узлы с пометкой "(удалить раздел)" — их не трогаем.
```

**Ценность:** онбординг по продукту — часы вместо недель. Старшие коллеги не отвлекаются на базовые вопросы.

---

### US-LEAD-2: Контроль актуальности тест-модели после релиза

> Как IT Lead, я хочу после каждого релиза видеть, какие узлы тест-модели были затронуты изменениями, чтобы назначить SA и QA на обновление артефактов.

**Инструменты:** `sc-mcp`, `filesystem-mcp`, `tracker-mcp`

**Сценарий:**
```
Пользователь: "Что изменилось в релизе 3.4 и какие узлы надо обновить?"

sc-mcp.list_merge_requests(milestone="3.4", status="merged")
  → 12 MR с описаниями

Claude Code анализирует MR-описания, сопоставляет с узлами по тегам:
  → 8 затронутых узлов в test-model (lv5–lv8)

filesystem-mcp.list_nodes_by_path(affected_paths)
  → 3 узла со status: covered — нужна проверка актуальности
  → 2 узла со status: missing  — новая функциональность без TC

tracker-mcp.create_task("[SA] Обновить требования по MR#341, #356")
tracker-mcp.create_task("[QA] Написать TC для новых lv7-узлов, релиз 3.4")
```

**Артефакт:** задачи в трекере с конкретными узлами для SA и QA.

---

### US-LEAD-3: Аудит MCP-инфраструктуры

> Как IT Lead, я хочу видеть, какие MCP-серверы подключены, их статус и последнее использование, чтобы управлять инфраструктурой AI-агентов.

**Инструменты:** `filesystem-mcp`

**Сценарий:**
```
Пользователь: "Покажи реестр MCP-серверов."

filesystem-mcp.read_node("mcp/INDEX.md")

Claude Code выводит:
| Сервер            | Статус      | Теги           |
| sc-mcp            | active      | api, sc        |
| tms-mcp           | active      | tms, qa        |
| wiki-mcp          | experimental| wiki, docs     |
| filesystem-mcp    | active      | fs, vault      |
| notifications-mcp | planned     | chat, alerts   |
| tracker-mcp       | experimental| tracker, bugs  |
| git-mcp           | planned     | git            |
| playwright-mcp    | planned     | ui, browser    |
```

**Ценность:** единая точка видимости инфраструктуры агентов, нет разрозненных конфигов.

---

---

# Разработчик (Developer)

## Контекст роли

Реализует функциональность. Приходит на задачу с вопросами: "что именно нужно сделать?", "какой API-контракт?", "как это соотносится с уже существующим кодом?". Хочет однозначный ответ, а не страницу вики с устаревшей информацией.

---

### US-DEV-1: Получить чёткое техническое задание по задаче

> Как разработчик, я хочу вставить ID задачи из трекера и получить структурированное ТЗ с API-контрактом, предусловиями и edge cases, чтобы не тратить время на поиск требований по wiki.

**Контекст:** `skills/sa/role.md` + `skills/common/product.md`

**Инструменты:** `tracker-mcp`, `wiki-mcp`, `filesystem-mcp`

**Сценарий:**
```
Пользователь: "Дай ТЗ по задаче SC-2341."

tracker-mcp.get_issue("SC-2341")
  → title: "API v2: добавить фильтр по автору в GET /branches"
  → linked node: "API v2 / Репозиторий / Ветки / Фильтры"

filesystem-mcp.read_node("API v2 / Репозиторий / Ветки / Фильтры")
wiki-mcp.get_page(linked_wiki_page)

Claude Code собирает ТЗ:
  ## GET /api/v2/repos/{owner}/{repo}/branches

  Параметры запроса:
  | Параметр  | Тип    | Обязательный | Описание        |
  | author    | string | нет          | логин автора    |
  | page      | int    | нет          | пагинация       |
  | limit     | int    | нет          | max 50          |

  Ответ 200: [{ name, sha, author, created_at }]
  Ошибки: 400 (невалидный автор), 404 (репо не найден)

  Edge cases:
  • автор не существует → пустой массив [], не 404
  • автор без веток → []
  • limit > 50 → 400 Bad Request
```

**Артефакт:** готовое ТЗ с API-контрактом прямо в сессии.

---

### US-DEV-2: Создать ветку и MR, связанные с узлом

> Как разработчик, я хочу создать ветку и MR в SourceControl уже с правильным именем и описанием, чтобы QA сразу понимал, что затронуто.

**Инструменты:** `sc-mcp`, `git-mcp`, `tracker-mcp`

**Сценарий:**
```
Пользователь: "Создай ветку и MR для SC-2341."

tracker-mcp.get_issue("SC-2341")
  → linked node: "API v2 / Репозиторий / Ветки / Фильтры", lv7
  → tags: [v2, repo, branch, ПАО]

sc-mcp.create_branch(
  repo="sourcecontrol/backend",
  name="feature/SC-2341-branch-author-filter",
  from="main"
)

sc-mcp.create_merge_request(
  title="feat(api-v2): фильтр веток по автору [SC-2341]",
  description="""
    Узел: API v2 / Репозиторий / Ветки / Фильтры (lv7, #ПАО)
    Задача: SC-2341
    Изменения: добавлен query-параметр ?author= в GET /branches
  """,
  labels=["v2", "ПАО"]
)
```

**Артефакт:** ветка + MR с координатой узла в описании. QA видит, что тестировать.

---

### US-DEV-3: Проверить, не сломал ли существующую функциональность

> Как разработчик, я хочу перед пушем спросить систему, какие соседние узлы могут быть затронуты моим изменением, чтобы оценить риск регрессии.

**Инструменты:** `git-mcp`, `filesystem-mcp`

**Сценарий:**
```
Пользователь: "Я изменил логику пагинации в API v2. Что может сломаться?"

git-mcp.diff(staged=true)
  → изменены: pagination.go, branch_handler.go

filesystem-mcp.list_nodes_by_tag(["v2"])
  → 47 узлов, из них затрагивающих пагинацию: 6

Claude Code:
  "Изменение пагинации может затронуть 6 узлов API v2:
   • API v2 / Репозиторий / Ветки / Список           lv7 covered TC-112
   • API v2 / Репозиторий / Коммиты / Список         lv7 covered TC-201
   • API v2 / Проект / Репозитории / Список          lv6 partial  —
   • ...
   Рекомендую: попросить QA перепрогнать TC-112, TC-201 после мержа."
```

**Ценность:** разработчик знает о рисках до code review, а не после обнаружения бага QA.

---

---

# Аналитик (SA — Systems Analyst)

## Контекст роли

Переводит бизнес-задачи в технические требования. Пишет API-контракты, use cases, описывает логику. Является мостом между PO и командой разработки/QA. Нуждается в согласованном формате артефактов и быстром доступе к контексту продукта.

---

### US-SA-1: Декомпозировать фичу в узлы тест-модели

> Как SA, я хочу загрузить свою роль и описать новую фичу, получив от системы готовые узлы для test-model с тегами и уровнями, чтобы не начинать с чистого листа.

**Контекст:** `skills/sa/role.md` + `skills/common/model.md` + `skills/common/product.md`

**Инструменты:** `filesystem-mcp`

**Сценарий:**
```
Пользователь:
  "Новая фича: пользователь может подписаться на уведомления
   о новых коммитах в ветку через UI и получать их в СберЧат."

Claude Code (SA-роль):
  Декомпозиция в узлы:

  lv5: UI / Проект / Репозиторий / Уведомления о ветках
    tags: [SC, UI, FE, repo, branch]
    status: missing

  lv6: ... / Подписка                    tags: [..., settings]
  lv6: ... / Список подписок             tags: [..., list]

  lv7: ... / Подписка / Создание         tags: [..., create]
  lv7: ... / Подписка / Удаление         tags: [..., delete]
  lv7: ... / Список / Фильтр по ветке    tags: [..., filter]
  lv8: ... / Создание / Валидация ветки  tags: [..., validation]
  lv8: ... / Создание / Дубликат         tags: [..., duplicate]

filesystem-mcp.write_nodes(nodes)  — создаёт .md файлы в test-model
```

**Артефакт:** 8 новых узлов в test-model, готовых к написанию требований и TC.

---

### US-SA-2: Написать API-контракт и опубликовать в wiki

> Как SA, я хочу сгенерировать черновик API-контракта по описанию фичи и сразу опубликовать его в wiki, чтобы разработчик и QA работали с одним источником правды.

**Контекст:** `skills/sa/role.md`

**Инструменты:** `wiki-mcp`, `filesystem-mcp`

**Сценарий:**
```
Пользователь:
  "Напиши API-контракт для подписки на уведомления о ветке.
   Узел: API v2 / Репозиторий / Ветки / Подписка, lv7."

Claude Code генерирует контракт в формате sa/role.md:

  ## POST /api/v2/repos/{owner}/{repo}/branches/{branch}/watch

  Узел: API v2 / Репозиторий / Ветки / Подписка
  Уровень: lv7, Версия: #v2 #ПАО

  Параметры: owner (path), repo (path), branch (path)
  Тело: { "channel": "sberchat", "events": ["push"] }

  Ответ 201: { "id": "uuid", "branch": "main", "channel": "sberchat" }
  Ошибки:
    400 — channel не поддерживается
    404 — ветка не существует
    409 — подписка уже существует

wiki-mcp.create_page(
  space="SC",
  title="API v2: POST /branches/{branch}/watch",
  content=contract,
  parent_page="API v2 Contracts"
)
```

**Артефакт:** API-контракт в wiki + ссылка в узле test-model.

---

### US-SA-3: Найти требования без покрытия тест-кейсами

> Как SA, я хочу видеть, для каких написанных мной требований QA ещё не написал TC, чтобы планировать объём работы QA к релизу.

**Инструменты:** `filesystem-mcp`, `tms-mcp`

**Сценарий:**
```
Пользователь: "Покажи требования SA без TC по API v2."

filesystem-mcp.list_nodes_by_tag(["v2"])
  + фильтр: status = "missing" OR status = "partial"

tms-mcp.list_test_cases(filter="node_path LIKE 'API v2%'")

Claude Code сопоставляет:
  Узлов в test-model (v2): 47
  Узлов с TC в TMS: 39
  Без TC: 8

  Список gap-ов:
  • API v2 / Репозиторий / Ветки / Подписка        lv7 missing #ПАО
  • API v2 / Репозиторий / Webhooks / Retry         lv8 missing
  • ...
```

**Ценность:** SA видит gap ещё до релиза-гейта, успевает эскалировать к QA заблаговременно.

---

### US-SA-4: Проверить согласованность требований между версиями API

> Как SA, я хочу сравнить поведение одной сущности в v1 и v2, чтобы явно описать delta и не допустить расхождений в реализации.

**Инструменты:** `filesystem-mcp`, `wiki-mcp`

**Сценарий:**
```
Пользователь: "Сравни поведение создания ветки в v1 и v2."

filesystem-mcp.read_node("API v1 / Репозиторий / Ветки / Создание")
filesystem-mcp.read_node("API v2 / Репозиторий / Ветки / Создание")
wiki-mcp.get_page("API v1: POST /branches")
wiki-mcp.get_page("API v2: POST /branches")

Claude Code:
  Delta v1 → v2:
  + параметр "protected" (bool) — новый
  + ответ включает "created_by" — новый
  ~ валидация имени: v1 допускает "/" в имени, v2 — нет
  - параметр "copy_permissions" удалён

  ⚠ Расхождение: v1 возвращает 200, v2 должен возвращать 201.
    Требует уточнения с BE.
```

---

---

# Тестировщик (QA)

## Контекст роли

Пишет тест-кейсы, прогоняет их, фиксирует дефекты. Работает с test-model как с основой: каждый TC привязан к узлу. Отвечает за покрытие и gate перед релизом. Нуждается в быстром создании TC без потери структуры и координат.

---

### US-QA-1: Сгенерировать тест-кейс из узла test-model

> Как QA, я хочу указать узел test-model и получить готовый черновик TC в формате команды, чтобы заполнить только специфичные детали, а не создавать всё с нуля.

**Контекст:** `skills/qa/role.md` + `skills/common/model.md`

**Инструменты:** `filesystem-mcp`, `tms-mcp`

**Сценарий:**
```
Пользователь:
  "Напиши TC для узла:
   UI / Проект / Репозиторий / Код / Ветки / Создание / Имя / По символам
   lv8, #UI, #branch, #ПАО"

filesystem-mcp.read_node(path)  — читает контекст узла и родительских

Claude Code (QA-роль) генерирует:

---
id: TC-DRAFT
node: UI / Проект / Репозиторий / Код / Ветки / Создание / Имя / По символам
lv: 8
tags: [UI, SC, FE, branch, ПАО]
api_version: web2
priority: high
status: draft
---

## TC: Создание ветки — валидация символов в имени

### Предусловие
- Пользователь авторизован, имеет права write на репозиторий

### Шаги
1. Открыть репозиторий → Код → Ветки
2. Нажать "Создать ветку"
3. Ввести имя с недопустимыми символами: "branch name!"
4. Нажать "Создать"

### Ожидаемый результат
- Отображается ошибка валидации
- Ветка НЕ создана

### Вариации (lv8 edge cases)
| Входные данные       | Ожидаемый результат        |
| "branch name"        | ошибка (пробел)             |
| "branch/sub"         | успех (слеш допустим)       |
| "branch..name"       | ошибка (двойная точка)      |
| "" (пустое)          | кнопка "Создать" задизейблена|
| 256 символов         | ошибка (превышение длины)   |

tms-mcp.create_test_case(tc_draft)
  → TC-4521

filesystem-mcp.update_node_status(path, "covered", tms_id="TC-4521")
```

**Артефакт:** TC в TMS, узел обновлён до `status: covered`.

---

### US-QA-2: Создать дефект-репорт с координатой

> Как QA, я хочу описать найденный баг и получить дефект-репорт в правильном формате с координатой узла, severity и шагами, чтобы разработчик понял без переспрашивания.

**Контекст:** `skills/qa/role.md`

**Инструменты:** `tracker-mcp`, `filesystem-mcp`

**Сценарий:**
```
Пользователь:
  "Баг: при создании ветки с именем 'main/sub' система создаёт её
   вместо ошибки валидации. Воспроизводится в web2 UI."

filesystem-mcp.list_nodes_by_tag(["branch", "create", "UI"])
  → предлагает узел: UI / ... / Ветки / Создание / Имя / По символам (lv8)

Claude Code (QA-роль) генерирует дефект-репорт:

## BUG: Ветка с именем 'main/sub' создаётся без ошибки

Узел: UI / Проект / Репозиторий / Код / Ветки / Создание / Имя / По символам
Уровень: lv8
Теги: #UI #SC #branch #ПАО
API версия: web2
Severity: Major
Priority: High
Связанный TC: TC-4521

### Фактическое поведение
Ветка 'main/sub' создана успешно, без ошибки валидации.

### Ожидаемое поведение
Согласно узлу lv8: слеш в середине имени — допустим,
НО 'main/sub' интерпретируется как создание подпространства имён.
Требуется уточнение у SA: это баг или допустимое поведение?

### Шаги воспроизведения
1. UI → Проект → Репозиторий → Код → Ветки
2. Нажать "Создать ветку"
3. Имя: "main/sub"
4. Нажать "Создать"

tracker-mcp.create_bug(bug_report)  → BUG-891
```

**Артефакт:** баг в трекере с координатой + вопрос к SA о поведении.

---

### US-QA-3: Gate перед релизом

> Как QA, я хочу одной командой запустить проверку релизной готовности: все #ПАО покрыты, все блокирующие баги закрыты, отчёт отправлен в чат.

**Инструменты:** `filesystem-mcp`, `tms-mcp`, `tracker-mcp`, `notifications-mcp`

**Сценарий:**
```
Пользователь: "Запусти gate-проверку перед релизом 3.5."

1. filesystem-mcp.list_missing_pao()
   → 1 узел: API v2 / Webhook / Retry, lv8, missing

2. tracker-mcp.list_sprint(milestone="3.5", status="open", priority="high")
   → 0 открытых high-priority багов

3. tms-mcp.get_coverage_report(filter="ПАО")
   → 35/36 covered (97%), 1 missing

Claude Code:
  "GATE: НЕ ПРОЙДЕН
   Причина: 1 узел #ПАО без TC
   → API v2 / Webhook / Retry (lv8)

   Открытых блокирующих багов: 0 ✓
   Покрытие #ПАО: 97% (1 missing)

   Действие: назначить написание TC-XXXX до EOD."

notifications-mcp.notify_release_blocker(
  channel="#sc-releases",
  blockers=[{"node": "API v2 / Webhook / Retry", "lv": 8}]
)
```

**Артефакт:** отчёт в чате + список блокеров с именами узлов.

---

### US-QA-4: Найти узлы, затронутые конкретным MR

> Как QA, я хочу по номеру MR понять, какие узлы test-model затрагивает изменение, чтобы запустить регрессию только по ним, а не по всей модели.

**Инструменты:** `sc-mcp`, `filesystem-mcp`

**Сценарий:**
```
Пользователь: "Что затрагивает MR#456?"

sc-mcp.get_merge_request(456)
  → изменены файлы: api/v2/branches.go, api/v2/pagination.go
  → описание MR: "feat: фильтр веток по автору [SC-2341]"

filesystem-mcp.list_nodes_by_tag(["v2", "branch"])
  → Claude Code сопоставляет изменения с узлами

Результат:
  Затронутые узлы (требуют перепрогона):
  • API v2 / Репозиторий / Ветки / Список        lv7, TC-112 ✓
  • API v2 / Репозиторий / Ветки / Фильтры       lv7, TC-NEW (новый)
  • API v2 / Репозиторий / Ветки / Пагинация     lv8, TC-203 ✓
```

---

---

# Автоматизатор (QA Automation)

## Контекст роли

Пишет автотесты, поддерживает тестовую инфраструктуру, интегрирует тесты в CI/CD. Получает TC от ручного QA и реализует их в коде. Нуждается в чётких acceptance criteria, генерации скелетов тестов и связи результатов прогонов с test-model.

---

### US-AUTO-1: Сгенерировать скелет автотеста из TC

> Как автоматизатор, я хочу передать ID тест-кейса и получить скелет автотеста на нужном фреймворке, чтобы реализовать только логику, а не писать бойлерплейт.

**Контекст:** `skills/qa/role.md` + spec-kit `spec.md` фичи

**Инструменты:** `tms-mcp`, `filesystem-mcp`, `sc-mcp`

**Сценарий:**
```
Пользователь: "Сгенерируй скелет автотеста для TC-4521 на Python + pytest."

tms-mcp.get_test_case("TC-4521")
  → node: UI / ... / Ветки / Создание / Имя / По символам
  → шаги и вариации (таблица edge cases)

Claude Code генерирует:

# test_branch_name_validation.py
# Node: UI / Проект / Репозиторий / Код / Ветки / Создание / Имя / По символам
# Level: lv8 | Tags: UI, SC, branch, ПАО | TC: TC-4521

import pytest
from playwright.sync_api import Page

INVALID_NAMES = [
    ("branch name",  "пробел"),
    ("branch..name", "двойная точка"),
    ("",             "пустое имя"),
    ("a" * 256,      "превышение длины"),
]
VALID_NAMES = [
    ("branch/sub",   "слеш допустим"),
]

class TestBranchNameValidation:
    @pytest.mark.parametrize("name,reason", INVALID_NAMES)
    def test_invalid_name_shows_error(self, page: Page, name, reason):
        # TODO: открыть репозиторий → Код → Ветки → Создать
        # TODO: ввести name, нажать "Создать"
        # TODO: assert error message visible
        # TODO: assert branch NOT created via API
        pass

    @pytest.mark.parametrize("name,reason", VALID_NAMES)
    def test_valid_name_creates_branch(self, page: Page, name, reason):
        # TODO: ...
        pass

sc-mcp.create_branch(
  repo="qa-automation/sc-tests",
  name="feat/TC-4521-branch-name-validation"
)
```

**Артефакт:** файл с тестом + ветка в репозитории автотестов.

---

### US-AUTO-2: Запустить smoke по узлам #ПАО через браузер

> Как автоматизатор, я хочу запустить smoke-проверку всех UI-узлов с тегом #ПАО прямо через MCP-браузер, чтобы быстро убедиться, что ничего критичного не сломалось.

**Инструменты:** `filesystem-mcp`, `playwright-mcp`

**Сценарий:**
```
Пользователь: "Запусти UI smoke по узлам #ПАО lv6."

filesystem-mcp.list_nodes_by_tag(["UI", "ПАО", "lv6"])
  → 11 узлов

Для каждого узла Claude Code формирует минимальный smoke-сценарий:

playwright-mcp.navigate("https://sc.internal/project/test-repo")
playwright-mcp.assert_element("[data-testid='branch-list']")
playwright-mcp.screenshot("smoke/branches-list.png")
→ PASS

playwright-mcp.navigate(".../merge-requests")
playwright-mcp.assert_element("[data-testid='mr-list']")
→ PASS

... (11 узлов)

Итог: 10/11 PASS, 1 FAIL
  FAIL: UI / Проект / Репозиторий / Настройки / Webhooks
  → element not found: [data-testid='webhook-list']
  → screenshot: smoke/webhooks-FAIL.png
```

**Артефакт:** отчёт прогона + скриншоты + список упавших узлов для QA.

---

### US-AUTO-3: Обновить статус покрытия по результатам CI

> Как автоматизатор, я хочу, чтобы после прогона автотестов в CI статусы узлов test-model обновлялись автоматически — passed → covered, failed → partial.

**Инструменты:** `tms-mcp`, `filesystem-mcp`, `notifications-mcp`

**Сценарий (CI hook):**
```
CI pipeline завершён. Результаты JUnit XML → передать агенту.

tms-mcp.update_run_result(run_id, results)

Claude Code анализирует results:
  TC-4521 PASSED → node: .../Ветки/Создание/Имя/По символам
  TC-4522 FAILED → node: .../Ветки/Создание/Имя/Длина

filesystem-mcp.update_node_status(".../По символам", "covered")
filesystem-mcp.update_node_status(".../Длина",       "partial")

Если упавший узел — #ПАО:
  notifications-mcp.send_message(
    "#sc-qa-alerts",
    "⚠ Автотест упал на #ПАО узле: .../Длина (lv8)\n
     CI run: #1234 | TC-4522 | Assignee: @qa_auto"
  )
```

**Ценность:** vault всегда отражает реальное состояние покрытия, синхронизованное с CI.

---

### US-AUTO-4: Сгенерировать автотест из spec.md (spec-kit)

> Как автоматизатор, я хочу взять acceptance criteria из spec.md и получить скелет тестов в test-first стиле, чтобы к моменту выхода фичи тесты были готовы принять реализацию.

**Инструменты:** `filesystem-mcp`, `sc-mcp`

**Сценарий:**
```
Пользователь: "Сгенерируй тесты из specs/042-batch-rename/spec.md"

filesystem-mcp.read_file("specs/042-batch-rename/spec.md")
  → User Story P1: batch rename
  → AC: Given 5 branches selected,
         When rename template "feature/{old}",
         Then all renamed, success toast shown

/speckit.tasks  →  tasks.md сгенерирован

tasks.md включает:
  [T-001] [P] [Story-1] Write failing test: batch_rename_success
  [T-002] [P] [Story-1] Write failing test: batch_rename_partial_fail
  [T-003]     [Story-1] Implement batch rename endpoint
  [T-004]     [Story-1] Make tests pass

/speckit.implement T-001 →
  Claude Code генерирует test_batch_rename.py
  с pytest.mark.xfail — тест написан, фейлит, ждёт реализации

sc-mcp.commit_file(
  repo="qa-automation/sc-tests",
  path="tests/test_batch_rename.py",
  message="test(TC-5001): failing tests for batch rename [T-001]"
)
```

**Артефакт:** тест с `xfail` в репозитории до того, как фича реализована.

---

## Сводная таблица: роль × MCP-сервер

|                     | sc-mcp | tms-mcp | wiki-mcp | tracker-mcp | filesystem-mcp | notifications-mcp | git-mcp | playwright-mcp |
|---------------------|:------:|:-------:|:--------:|:-----------:|:--------------:|:-----------------:|:-------:|:--------------:|
| PO                  |        | ✓       |          |             | ✓              | ✓                 |         |                |
| IT Lead             | ✓      |         |          | ✓           | ✓              | ✓                 |         |                |
| Разработчик         | ✓      |         | ✓        | ✓           |                |                   | ✓       |                |
| SA                  | ✓      |         | ✓        | ✓           | ✓              |                   |         |                |
| QA                  |        | ✓       |          | ✓           | ✓              | ✓                 |         |                |
| Автоматизатор       | ✓      | ✓       |          |             | ✓              | ✓                 | ✓       | ✓              |
