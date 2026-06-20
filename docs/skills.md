# Ролевые скиллы

## Что такое скиллы

Файлы в `vault/skills/` — это system prompt, разбитый по ролям. При открытии чата с нужным контекстом ассистент «становится» SA, QA, BE или FE специалистом, знающим конкретно этот продукт.

Скиллы используются двумя способами:
1. **Напрямую** — скопировать содержимое в system prompt перед сессией
2. **Через openspec** — скрипт `build-openspec-config.sh` собирает `openspec/config.yaml`, который openspec CLI использует при генерации инструкций

---

## common/ — общий контекст

Файлы из `common/` включаются в **context** для всех ролей в openspec.

### product.md

Описание продукта: интерфейсы, версии API, интеграции, основные сущности, аутентификация, deprecated.
Содержит систему тегов (`#UI`, `#api`, `#v1`, `#ПАО`, `#project`, `#repo` и т.д.).

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

