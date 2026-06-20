# Ролевые скиллы для Claude

## Что такое скиллы

Файлы в `vault/skills/` — это system prompt для Claude, разбитый по ролям. При открытии чата с нужным контекстом Claude «становится» SA, QA, BE или FE специалистом, знающим конкретно этот продукт.

Скиллы используются двумя способами:
1. **Напрямую** — скопировать содержимое в system prompt перед сессией
2. **Через openspec** — скрипт `build-openspec-config.sh` собирает `openspec/config.yaml`, который openspec CLI использует при генерации инструкций

---

## Структура vault/skills/

```
vault/skills/
├── common/                   # Общий контекст (идёт во все роли)
│   ├── product.md            # Описание продукта SourceControl (интерфейсы, API, сущности)
│   ├── model.md              # Система координат: иерархия lv1–lv8, теги, статусы
│   └── ai-native-workflow.md # Intent-Steward: роль фасилитатора утренних сессий
├── sa/                       # Системный аналитик
│   └── role.md
├── be/                       # Backend-разработчик (Go + Gitea)
│   ├── role.md
│   ├── architecture.md       # Слои, нейминг, DI
│   ├── endpoint-flow.md      # Контракт → handler → роут
│   ├── errors-logging.md     # Враппинг %w, уровни логов, трейсинг
│   ├── db-xorm.md            # DTO/Entity, доступ к БД через xorm
│   ├── migrations.md         # Миграции БД (SQL != SELECT → аппрув человека)
│   ├── submodule.md          # Сверка контракта с vcs-api submodule
│   ├── git-flow.md           # Ветки feature/VCS-XXXX, формат коммита
│   ├── code-review.md        # Шаблон PR, red flags, порядок мёржа
│   ├── testing.md            # Unit-тесты, mockery, корнер-кейсы
│   └── review_spec_ui.md     # Гейт ревью UI-контракта перед be-design
├── fe/                       # Frontend-разработчик (React18, FSD, web2)
│   ├── role.md
│   ├── architecture.md       # FSD-слои (web_src/spa), React Query, API /apifront/web/v2
│   ├── api-client.md         # Orval-кодоген из vcs-api, generated не трогать
│   ├── create-page.md        # Создание страницы + синхронизация с gitea-react-adapter
│   ├── styleguide.md         # React Style Guide (named imports, data-testid, без FC)
│   ├── states-checklist.md   # loading/empty/error/no-access, права доступа, standalone
│   ├── testing.md            # WireMock (моки) + Playwright
│   └── review.md             # lint/ts:lint/css/fsd, готовность к PR
└── qa/                       # Тестировщик
    ├── role.md
    ├── INDEX.md
    ├── BASE-TESTING.md
    ├── API-SWAGGER-TESTING.md
    ├── UI-FRONTEND-TESTING.md
    └── patterns.md
```

---

## common/ — общий контекст

Файлы из `common/` включаются в **context** для всех ролей в openspec.

### product.md

Описание продукта: интерфейсы, версии API, интеграции, основные сущности, аутентификация, deprecated.
Содержит систему тегов (`#UI`, `#api`, `#v1`, `#ПАО`, `#project`, `#repo` и т.д.).

### model.md

**Система координат** — единая для всей команды.

Иерархия уровней:
| Уровень | Что описывает |
|---------|---------------|
| lv1 | Интерфейс/подсистема (UI, API, CLI) |
| lv2 | Крупный раздел (Проект, v1/v2, Kafka) |
| lv3 | Секция (Репозитории, Настройки) |
| lv4 | Конкретная сущность (Репозиторий, Webhook) |
| lv5 | Область функциональности (Код, MR, Создание) |
| lv6 | Фича (Ветки, Коммиты, Теги) |
| lv7 | Конкретная операция (Создание ветки, Удаление тега) |
| lv8 | Атомарный сценарий / ограничение |

Узел с тегом `#ПАО` и статусом `status: missing` → **блокирует релиз**.

Основной уровень для TC: **lv7–lv8**.

### ai-native-workflow.md

Роль **Intent Steward** — фасилитатор утренних сессий команды по методологии Intent-Driven Development. Помогает формулировать бизнес-намерение цикла через сократический диалог. Результат: Daily Intent Contract.

---

## Как скиллы попадают в openspec

`openspec/config.yaml` собирается из `vault/skills/` через `make openspec-config`. Маппинг:

- `common/` → поле `context` (общий контекст для всех ролей, лимит 50KB)
- `sa/` → rules для артефактов `proposal`, `sa-specs`
- `be/` → rules для артефактов `be-design`, `be-tasks`
- `fe/` → rules для артефакта `fe-design`
- `qa/` → rules для артефакта `qa-plan`
- `qa/` + `qaa/` → rules для артефакта `qaa-tasks`

```bash
make openspec-config   # только пересборка config.yaml
make sync              # пересборка + валидация схемы
```

`openspec/config.yaml` генерируется автоматически — **не редактировать вручную**.

---

## vault/knowledges/ — глубокие знания

Дополнение к скиллам: детальные технические заметки, не вошедшие в скилл.

```
vault/knowledges/
├── fe/              # Глубокие знания по FE (web_src, адаптер, легаси, WireMock и др.)
│   ├── README.md
│   ├── architecture.md
│   ├── codegen.md
│   ├── stack.md
│   ├── styleguide.md
│   ├── tools.md
│   ├── ui-system.md
│   ├── wiremock.md
│   ├── gitea-react-adapter.md
│   ├── webpage-creation.md
│   ├── development-checklist.md
│   ├── legacy.md
│   └── git-tech-overview.md
└── onbording/       # Онбординг нового участника команды
```

В инструкциях fe-скилла и apply-стадии ссылки вида `vault/knowledges/fe/` указывают Claude читать эти файлы дополнительно.
