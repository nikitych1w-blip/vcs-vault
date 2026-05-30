---
tags: [faq]
---

# FAQ — vcs-vault

## Что такое vcs-vault?

Obsidian-vault команды продукта SourceControl. Хранит внешние источники знаний, ролевые скиллы для Claude и описания MCP-серверов. Все внешние источники управляются через CLI `sync` и описаны в `sources.yaml`.

---

## Как синхронизировать источники?

```bash
make status                          # состояние всех источников
make clone                           # первичное клонирование всех
make clone SOURCES="01-git 02-gitea" # клонировать конкретные
make pull                            # обновить все
make pull SOURCES=01-git             # обновить один
```

---

## Как добавить источник?

### 1. Добавить запись в `sources.yaml`

Файл находится в корне репозитория. Пронумеруй источник следующим по порядку индексом.

**git-источник:**
```yaml
- name: 10-my-repo
  description: Краткое описание
  type: git
  url: https://github.com/org/repo.git   # или git@host:org/repo.git для SSH
  path: sources/my-repo
  branch: main                           # опционально, умолчание — default branch
  sparse_checkout:                       # опционально
    - /docs/
  optional: true                         # пропускать при недоступности SSH
  post_process:                          # опционально
    - type: rename_ext
      dir: docs
      from: .txt
      to: .md
    - type: replace_in_files
      dir: docs
      glob: "*.md"
      pattern: 'old pattern'
      replacement: 'new value'
```

**wiki-источник (SberTrack):**
```yaml
- name: 10-my-wiki
  description: Краткое описание
  type: wiki
  space: SPACE_CODE
  path: sources/wiki/SPACE_CODE
  env:
    token: SBERTRACK_TOKEN
    base_url: SBERTRACK_BASE   # опционально
```

### 2. Создать FAQ-файл

Создай `faq/sources/10-my-repo.md` по образцу соседних файлов:

```markdown
---
tags: [faq, source, my-repo]
source: 10-my-repo
---

# FAQ — 10-my-repo

**Что это?** ...
**Где лежит?** `sources/my-repo/`
**Как обновить?**
\`\`\`bash
make pull SOURCES=10-my-repo
\`\`\`
**Что внутри?** ...
```

### 3. Добавить путь в `.gitignore` (если нужно)

Если источник не должен попадать в репозиторий:
```
sources/my-repo/
```

### 4. Склонировать

```bash
make clone SOURCES=10-my-repo
```

---

## Сценарии

| Файл | Описание |
|------|----------|
| [scenario-endpoint-to-test](scenario-endpoint-to-test.md) | От спеки эндпоинта до автотестов (SA → QA → QAA) |

---

## Где найти FAQ по конкретному источнику?

Все FAQ по источникам лежат в [`faq/sources/`](sources/):

| Файл | Источник |
|------|----------|
| [01-git](sources/01-git.md) | Pro Git book |
| [02-gitea](sources/02-gitea.md) | Gitea docs |
| [03-vcs-playwright](sources/03-vcs-playwright.md) | E2E-тесты |
| [04-vcs-arch](sources/04-vcs-arch.md) | Архитектурные материалы |
| [05-vcs-api](sources/05-vcs-api.md) | API-спецификации |
| [06-vcs-sc](sources/06-vcs-sc.md) | Основной репозиторий |
| [07-vcs-monitoring](sources/07-vcs-monitoring.md) | Мониторинг |
| [08-wiki-vcs](sources/08-wiki-vcs.md) | VCS wiki (SberTrack) |
| [09-task-tracker](sources/09-task-tracker.md) | Task tracker wiki (SWTR) |
