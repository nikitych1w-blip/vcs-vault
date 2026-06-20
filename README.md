# vcs-vault

Obsidian-vault команды продукта **SourceControl** — корпоративной VCS-платформы на базе Gitea.

Хранит знания о продукте, тест-модель и ролевые скиллы для работы с Claude.

---

## Документация

| | |
|---|---|
| [docs/overview.md](docs/overview.md) | Общий обзор: продукт, структура репозитория |
| [docs/sources.md](docs/sources.md) | Управление внешними источниками знаний |
| [docs/skills.md](docs/skills.md) | Ролевые скиллы для Claude |
| [docs/openspec.md](docs/openspec.md) | Схема артефактов и процесс изменений |
| [docs/test-model.md](docs/test-model.md) | Тест-модель продукта (lv1–lv8) |
| [docs/workflow.md](docs/workflow.md) | Рабочий процесс от идеи до реализации |

---

## Первый запуск

```bash
make clone   # клонировать внешние источники
make sync    # пересобрать openspec/config.yaml + валидировать схему
```

Открыть папку как Obsidian vault.

**Зависимости:** Go 1.22+, git, pandoc, SSH-ключ для внутренних репо, `SBERTRACK_TOKEN` для wiki.

---

## Основные команды

```bash
make clone SOURCES="01-git 02-gitea"            # клонировать конкретные источники
make pull                                        # обновить все источники
make vault-status                                # статус источников

make openspec-new CHANGE=vcs-10012-name          # создать изменение
make openspec-flow CHANGE=vcs-10012-name         # провести изменение через все артефакты
make openspec-flow-resume CHANGE=vcs-10012-name  # продолжить прерванный flow
```
