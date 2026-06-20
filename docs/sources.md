# Управление источниками знаний

## Что такое источники

Внешние репозитории и wiki-пространства, которые vault клонирует локально в `sources/`. Все источники описаны в [`sources.yaml`](../sources.yaml).

После клонирования Obsidian умеет линковать ноды vault на файлы в `sources/`.

---

## Реестр источников (sources.yaml)

| ID | Название | Тип | Путь | Обязателен |
|----|----------|-----|------|------------|
| 01-git | Pro Git book (English, 1st edition) | git | `sources/git` | да |
| 02-gitea | Gitea official documentation | git | `sources/gitea` | да |
| 03-vcs-playwright | VCS E2E Playwright tests | git | `sources/vcs-playwright` | optional (SSH) |
| 04-vcs-arch | VCS architecture docs (C4, PlantUML) | git | `sources/vcs-arch` | optional (SSH) |
| 05-vcs-api | VCS API specs и Postman collections | git | `sources/vcs-api` | optional (SSH) |
| 06-vcs-sc | VCS source control core (основной репо) | git | `sources/vcs-sc` | optional (SSH) |
| 07-vcs-monitoring | VCS monitoring dashboards (Grafana) | git | `sources/vcs-monitoring` | optional (SSH) |
| 08-wiki-vcs | VCS internal wiki (SberTrack) | wiki | `sources/wiki/VCS` | optional (TOKEN) |
| 09-task-tracker | Task tracker wiki (SberTrack) | wiki | `sources/wiki/SWTR` | optional (TOKEN) |
| 10-gitlab | GitLab/Gitaly docs | git | `sources/gitlab` | да |
| 11-vcs-docs | SourceControl release docs | git | `sources/vcs-docs` | optional (SSH) |
| 12-gitaly-api | Gitaly proto API | git | `sources/gitaly-api` | optional (SSH) |

Optional-источники пропускаются без ошибки, если SSH-доступ или токен недоступны.

---

## Команды управления

```bash
make clone                              # Клонировать все источники
make clone SOURCES="01-git 02-gitea"    # Клонировать конкретные
make pull                               # Обновить все источники
make pull SOURCES=01-git                # Обновить конкретный
make vault-status                       # Состояние всех источников
```

Все команды строят бинарь `sync` из `vault-cli/` перед выполнением.

---

## Типы адаптеров

### Тип `git`

Клонирует / обновляет git-репозиторий.

Дополнительные опции в `sources.yaml`:
- `sparse_checkout` — список путей для sparse checkout (клонировать только часть репо)
- `branch` — ветка (по умолчанию HEAD)
- `post_process` — действия после клонирования:
  - `rename_ext` — переименовать расширения файлов (например `.markdown` → `.md`)
  - `replace_in_files` — патч ссылок в файлах (regex → replacement)

Пример (01-git):
```yaml
sparse_checkout:
  - /en/
  - /figures/
post_process:
  - type: rename_ext
    dir: en
    from: .markdown
    to: .md
  - type: replace_in_files
    dir: en
    glob: "*.md"
    pattern: 'Insert \(18333fig([0-9]*)\)\.png'
    replacement: '![](../../figures/18333fig${1}-tn.png)'
```

### Тип `wiki`

Скачивает страницы из SberTrack через async export API, конвертирует PDF → Markdown через pandoc.

Требует переменных окружения:
- `SBERTRACK_TOKEN` — токен доступа
- `SBERTRACK_BASE` (опционально) — переопределить базовый URL портала

---

## vault-cli: Go-бинарь sync

Расположен в `vault-cli/`. Использует Cobra для CLI, gopkg.in/yaml.v3 для парсинга `sources.yaml`.

### Команды

```
sync clone [source-names...]   # Клонировать источники
sync pull [source-names...]    # Обновить источники
sync status                    # Статус всех источников
```

### Архитектура

```
vault-cli/
├── main.go
├── cmd/
│   ├── root.go       # Cobra root + флаг -c (config path)
│   ├── clone.go      # cobra clone command
│   ├── pull.go       # cobra pull command
│   ├── status.go     # cobra status command
│   └── run.go        # runner: загружает config, вызывает adapter
└── internal/
    ├── config/       # Парсинг sources.yaml → структуры Source
    └── adapter/
        ├── adapter.go    # Interface Adapter (Clone, Pull, Status)
        ├── git/
        │   ├── git.go    # GitAdapter: clone + sparse-checkout + post_process
        │   └── api.go    # Вспомогательные операции с git
        └── wiki/
            ├── wiki.go   # WikiAdapter: async export + download + pandoc
            └── api.go    # SberTrack wiki API client
```
