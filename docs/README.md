# docs/

Документация по устройству vcs-vault для LLM и новых участников команды.

## Файлы

| Файл | Что описывает |
|------|---------------|
| [overview.md](overview.md) | Что такое vault, зачем нужен, полная структура директорий |
| [sources.md](sources.md) | Управление внешними источниками знаний (sources.yaml, vault-cli, адаптеры) |
| [skills.md](skills.md) | Ролевые скиллы для Claude: структура, содержание, как собираются в openspec/config.yaml |
| [openspec.md](openspec.md) | Схема изменений и артефактов: schema.yaml, команды, директория изменения, форматы |
| [test-model.md](test-model.md) | Иерархическая тест-модель продукта: уровни lv1–lv8, теги, статусы, использование |
| [workflow.md](workflow.md) | Рабочий процесс от идеи до реализации: все шаги, роли, команды |

## Быстрый старт для LLM

1. Прочитать [overview.md](overview.md) — общая картина
2. Прочитать [workflow.md](workflow.md) — как работает процесс
3. Найти нужную роль в `vault/skills/<role>/role.md`
4. При работе с изменением — прочитать [openspec.md](openspec.md)
5. При работе с тест-моделью — прочитать [test-model.md](test-model.md)

## Ключевые файлы в репозитории

| Путь | Назначение |
|------|-----------|
| `sources.yaml` | Реестр внешних источников (единственный источник правды) |
| `vault/skills/common/product.md` | Описание продукта SourceControl |
| `vault/skills/common/model.md` | Система координат (lv1–lv8, теги, #ПАО) |
| `openspec/schemas/vcs/schema.yaml` | Схема артефактов openspec |
| `openspec/config.yaml` | Сборка скиллов для openspec (генерируется, не редактировать) |
| `Makefile` | Все команды управления vault |
| `vault/test-model/INDEX.md` | Индекс тест-модели |
