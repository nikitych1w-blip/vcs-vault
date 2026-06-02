# vcs-vault

Obsidian-vault команды продукта **SourceControl** — корпоративной VCS-платформы на базе Gitea.

Хранит знания о продукте, тест-модель, ролевые скиллы для работы с Claude и описания MCP-серверов.

---

## Структура

```
vcs-vault/
├── faq/                      # Краткие справки по каждому источнику знаний
├── sources/                  # Внешние источники знаний (управляются через sync)
│   ├── git/                  # Pro Git book (github.com/progit/progit)
│   ├── gitea/                # Документация Gitea (gitea.com/gitea/docs)
│   ├── vcs-api/              # OpenAPI-спецификации (SSH, optional)
│   ├── vcs-arch/             # Архитектурные решения (SSH, optional)
│   ├── vcs-monitoring/       # Мониторинг (SSH, optional)
│   ├── vcs-playwright/       # E2E-тесты (SSH, optional)
│   ├── vcs-sc/               # Основной репозиторий (SSH, optional)
│   └── wiki/
│       └── SWTR/             # SberTrack wiki: task-tracker + api.yaml
├── skills/                   # Ролевые скиллы для Claude
│   ├── common/               # Общий контекст продукта
│   ├── po/                   # Product Owner
│   ├── sa/                   # Системный аналитик
│   ├── qa/                   # Тестировщик
│   └── be/                   # Backend-разработчик
├── mcp/                      # MCP-серверы
├── vault-cli/                # Go CLI для управления источниками
│   ├── cmd/                  # clone · pull · status
│   ├── internal/
│   │   ├── adapter/git/      # git clone/pull + sparse-checkout + постобработка
│   │   └── adapter/wiki/     # sberwiki async export API → PDF → Markdown
│   └── go.mod
├── sources.yaml              # Реестр всех источников знаний
├── Makefile
└── vault.canvas              # Карта репозитория (Obsidian Canvas)
```

---

## Управление источниками

Все внешние источники описаны в [`sources.yaml`](sources.yaml) и управляются через бинарник `sync`:

```bash
make status                       # состояние всех источников
make clone                        # первоначальное клонирование всех
make clone SOURCES="01-git 02-gitea"   # клонировать конкретные
make pull                              # получить обновления для всех
make pull SOURCES=01-git               # обновить конкретный
```

### Типы адаптеров

| Тип | Описание |
|-----|----------|
| `git` | Клонирует / обновляет git-репозиторий. Поддерживает sparse checkout и постобработку файлов (переименование расширений, патч ссылок). |
| `wiki` | Скачивает страницы из SberTrack wiki через async export API (PDF), извлекает текст через `pdftotext` (poppler). Требует `SBERTRACK_TOKEN`. |

Репозитории с пометкой `optional: true` пропускаются без ошибки, если SSH-доступ недоступен.

---

## OpenSpec one-command flow

Для semi-auto сценария без ручного copy-paste из terminal stdout используйте единый запуск:

```bash
make openspec-flow CHANGE=vcs-10012-add-reactions
```

Что делает цель:
- опционально запускает `openspec-config` и `openspec-validate` (через `AUTO_SYNC=1`);
- создаёт change при отсутствии;
- проходит артефакты схемы `vcs` в порядке `proposal -> sa-specs -> be-design -> fe-design -> qa-plan -> qaa-tasks -> be-tasks`;
- сохраняет `openspec ... --json` и готовые session prompt файлы в директорию change;
- ставит confirm-gates перед `apply` и `archive`.

Полезные параметры:

```bash
# выключить pre-sync (config + validate)
make openspec-flow CHANGE=vcs-10012-add-reactions AUTO_SYNC=0

# продолжить с checkpoint
make openspec-flow-resume CHANGE=vcs-10012-add-reactions

# автоматом пройти archive-gate
make openspec-flow CHANGE=vcs-10012-add-reactions AUTO_ARCHIVE=1

# переопределить директорию служебного состояния
make openspec-flow CHANGE=vcs-10012-add-reactions FLOW_STATE_DIR=.openspec-flow
```

По умолчанию state и prompt-файлы лежат в:
`openspec/changes/<change>/.openspec-flow/`.

---

## Первый запуск

```bash
git clone <repo-url>
cd vcs-vault
make clone
```

Открыть папку как Obsidian vault.

### Зависимости

- Go 1.22+
- git
- `pdftotext` (poppler / poppler-utils) — для wiki-адаптера (PDF → текст)
- SSH-ключ с доступом к внутренним репозиториям (для `vcs-*`)
- `SBERTRACK_TOKEN` (для wiki-источников)
