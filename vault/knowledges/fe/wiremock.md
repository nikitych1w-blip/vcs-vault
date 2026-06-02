# WireMock Guide

Источник: [VCS-8337](https://portal.works.prod.sbt/pages/viewpage.action?pageId=...) — Гайды

---

## Основные сценарии маппинга

### 1. Сценарий: `EntityScenarioQuery` (список)
- **Запрос:** `GET /projects/{projectId}/entities`
- **Ответ:** 200, тело из `entities/list-query.json`
- **Состояние:** `QueryListReturned`
- **Дальнейшие запросы:** Возвращают тот же ответ

### 2. Сценарий: `EntityScenarioItem` (конкретная сущность)
- **Запрос:** `GET /projects/{projectId}/entities/{entityId}` (ID: `[a-zA-Z0-9-]+`)
- **Ответ:** 200, тело из `entities/item.json`
- **Состояние:** `EntityFound`
- **Важно:** Состояние глобальное — все ID возвращают одинаковый ответ

### 3. Сценарий: `EntityScenarioCreate` (создание)
- **Первый запрос:** `POST /projects/{projectId}/entities`
  - Ответ: 400, `entities/error.json` → состояние `CreateFailed`
- **Второй запрос:** `POST /projects/{projectId}/entities`
  - Ответ: 201, `entities/create.json` → состояние `CreateSucceeded`
- **Дальнейшие запросы:** Возвращают `create.json`

### 4. Сценарий: `EntityScenarioDelete` (удаление)
- **Первый запрос:** `DELETE /projects/{projectId}/entities/{entityId}`
  - Ответ: 404, `entities/error.json` → состояние `DeleteFailed`
- **Второй запрос:** `DELETE /projects/{projectId}/entities/{entityId}`
  - Ответ: 200, `entities/list-deleted.json` → состояние `DeleteSucceeded`

---

## FAQ

### Почему не работает созданный маппинг?
- Убедитесь, что файлы загружены в `__files` и `mappings`
- Перезапустите WireMock-сервер
- Проверьте **приоритеты** в `__mappings` — меньше число = выше приоритет

### Почему не работают сценарии?
Сценарии работают только при **точном совпадении**:
- Имя сценария (`scenarioName`)
- Текущее состояние (`requiredScenarioState`)
- Параметры запроса (метод, URL, заголовки, query-параметры)

**Проверьте:**
- Начальное состояние = `"Started"`
- Цепочка состояний логически непрерывна
- Нет опечаток в названиях состояний

**Важно:** Сценарии **глобальные** — не привязаны к конкретному ID или параметру.

### Почему некоторые сценарии пропускаются?
В режиме разработки (React Dev Server) возможны **дублирующие запросы** из-за Strict Mode или preflight-запросов.

**Решения:**
- Используйте production-сборку фронтенда
- Или отправляйте запросы через `curl` / Postman / тесты
- Либо сбрасывайте сценарии через `POST /__admin/scenarios/reset`

### Почему срабатывает не тот маппинг?
WireMock выбирает по **наилучшему совпадению**. При равенстве — приоритет.

**Причины:**
- Неточность в регулярных выражениях (`urlPathPattern`)
- Отсутствие учёта query-параметров, заголовков или тела
- Конфликт между stateless- и stateful-маппингами

**Решения:**
- Явно задайте `priority` (меньше число = выше приоритет)
- Убедитесь в корректности паттернов (например, `[a-zA-Z0-9-]+` не покрывает `_` или `.`)
- Используйте `/__admin/requests` для диагностики
