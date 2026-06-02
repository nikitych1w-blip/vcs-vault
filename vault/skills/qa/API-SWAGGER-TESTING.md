# Скилл: Ручное API тестирование по OpenAPI/Swagger

> Базовый скилл: `BASE-TESTING.md`  
> Артефакты SA: `vault/specs/`  
> Спецификации: `sources/vcs-api/`

---

## Зоны ответственности

1. **Анализ спецификации** — изучение OpenAPI/Swagger YAML/JSON для понимания контракта
2. **Проверка полноты спецификации** — выявление отсутствующих параметров, кодов ответов, примеров
3. **Валидация контракта с SA-требованиями** — сверка эндпоинта с AC в spec.md
4. **Написание TC для API** — каждый TC привязан к эндпоинту и методу
5. **Ручное тестирование endpoint'ов** — отправка запросов, проверка кодов, тел, заголовков
6. **Тестирование edge cases** — валидация ошибок, ограничений, boundary values
7. **Дефекты API** — баги с указанием эндпоинта, метода, кодов ответов

---

## Жизненный цикл API тестирования

```
Фаза 1  Подготовка        →  Получить OpenAPI-спецификацию (sources/vcs-api/)
Фаза 2  Анализ контракта  →  Изучить paths, methods, parameters, schemas
Фаза 3  Сверка с SA       →  Сопоставить эндпоинт с SA-требованиями (spec.md)
Фаза 4  Планирование TC   →  Определить набор проверок для каждого endpoint'а
Фаза 5  Ручное тестирование →  Execute requests, verify responses, fix bugs
Фаза 6  Отчётность       →  Дефекты, обновление спецификации, TC в TMS
```

---

## Анализ OpenAPI/Swagger спецификации

### Структура спецификации

```yaml
openapi: 3.1.0
info:
  title: SourceControl API
  version: 2.0.0
servers:
  - url: https://portal.works.prod.sbt/api/v2
paths:
  /repositories/{owner}/{repo}/branches:
    get:
      summary: Список веток
      operationId: listBranches
      parameters:
        - name: owner
          in: path
          required: true
          schema:
            type: string
        - name: repo
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Список веток
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Branch'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
```

### Что проверять в спецификации

| Элемент | Вопросы для тестировщика |
|---------|--------------------------|
| **paths** | Есть ли эндпоинт для всех AC из spec.md? |
| **methods** | Все ли HTTP-методы описаны (GET, POST, PUT, DELETE, PATCH)? |
| **parameters** | Все ли параметры обязательные? Есть ли валидация типов? |
| **requestBody** | Описаны ли все поля? Есть ли примеры? |
| **responses** | Для всех 2xx, 4xx, 5xx кодов описаны тела ответов? |
| **schemas** | Есть ли примеры для всех моделей? |
| **security** | Аутентификация указана? Какие токены нужны? |

### Чеклист анализа спецификации

- [ ] Для каждого эндпоинта описаны все методы (GET, POST, PUT, DELETE, PATCH)
- [ ] Для каждого параметра указан тип, обязательность, ограничения
- [ ] Для каждого кода ответа (2xx, 4xx, 5xx) описано тело response
- [ ] Есть примеры запросов и ответов
- [ ] Указана аутентификация (access-token, JWT, ...)
- [ ] Нет ссылок на несуществующие schemas/responses

---

## Сверка с SA-требованиями

### Сопоставление эндпоинта с AC

**SA-требование (spec.md):**
```markdown
**AC-123.1** — успешное создание ресурса
Given: пользователь авторизован, тело валидно
 When: POST /api/v2/{owner}/{repo}/resource
 Then: 201 + тело с id

**AC-123.2** — 400 при невалидном теле
Then: 400 + body: { "message": "..." }

**AC-123.3** — 403 без прав
Then: 403
```

**Тест-кейсы на основе AC:**
| TC | Эндпоинт | Метод | Код | AC |
|----|----------|-------|-----|----|
| TC-1001 | POST /api/v2/{owner}/{repo}/resource | POST | 201 | AC-123.1 |
| TC-1002 | POST /api/v2/{owner}/{repo}/resource | POST | 400 | AC-123.2 |
| TC-1003 | POST /api/v2/{owner}/{repo}/resource | POST | 403 | AC-123.3 |

### Проверка покрытия

1. Открыть spec.md → найти все AC
2. Открыть OpenAPI-спецификацию → найти эндпоинт
3. Для каждого AC написать TC с соответствующим методом и кодом ответа

**Если AC не покрыт → открыть задачу SA для уточнения или обновления спецификации**

---

## Формат TC для API

```markdown
---
id: TC-XXXX
node: API / v2 / resource / POST / Создание
lv: 7
tags: [api, v2, SC, resource]
api_version: v2
status: covered
priority: high
tms: TC-XXXX
---

## TC-XXXX: POST /api/v2/{owner}/{repo}/resource — создание ресурса

**Узел**: `API / v2 / resource / POST / Создание` (lv7)  
**Эндпоинт**: `POST /api/v2/{owner}/{repo}/resource`  
**Аутентификация**: access-token

### Предусловия
- Пользователь авторизован (access-token в заголовке)
- Репозиторий существует
- Нет ограничений квоты

### Тело запроса
```json
{
  "name": "test-branch",
  "ref": "refs/heads/main"
}
```

### Ожидаемые результаты

#### Сценарий 1: Успешное создание
- HTTP 201 Created
- Header `Location`: `/api/v2/{owner}/{repo}/branches/test-branch`
- Тело:
  ```json
  {
    "id": 1,
    "name": "test-branch",
    "ref": "refs/heads/main",
    "commit": { ... }
  }
  ```

#### Сценарий 2: 400 — невалидное тело
- HTTP 400 Bad Request
- Тело: `{ "message": "name is required" }`

#### Сценарий 3: 401 — не авторизован
- HTTP 401 Unauthorized
- Тело: `{ "message": "authentication required" }`

#### Сценарий 4: 403 — нет прав
- HTTP 403 Forbidden
- Тело: `{ "message": "permission denied" }`

#### Сценарий 5: 404 — репозиторий не найден
- HTTP 404 Not Found
- Тело: `{ "message": "repository not found" }`

### Альтернативные сценарии

#### Границы значений
- `name`: 1 символ, 255 символов, 256 символов
- Пустое тело
- Отсутствует обязательный параметр

#### Специальные символы
- `name`: `test branch`, `test_branch`, `test-branch`, `TestBranch`

### Параметры запроса
| Параметр | Значение | Описание |
|----------|----------|----------|
| `owner` | `valid-owner` | Владелец репозитория |
| `repo` | `valid-repo` | Имя репозитория |

### Проверки
- [ ] Код ответа соответствует ожидаемому
- [ ] Заголовки (Location, Content-Type) валидны
- [ ] Тело ответа соответствует schema
- [ ] Созданный ресурс доступен через GET
- [ ] При дублировании — 409 Conflict

### Фактический результат
- [ ] Сценарий 1: ...
- [ ] Сценарий 2: ...
- [ ] ...

### Комментарий тестировщика
- ...
```

---

## Чеклист ручного API тестирования

### Подготовка
- [ ] Получена актуальная OpenAPI-спецификация
- [ ] Тест-кейсы написаны и утверждены
- [ ] Инструмент для запросов (Postman, curl, Insomnia)
- [ ] Access token / JWT валиден

### Выполнение
- [ ] Для каждого сценария TC:
  - [ ] Отправлен запрос с правильными параметрами
  - [ ] Записан код ответа
  - [ ] Записаны заголовки ответа
  - [ ] Записано тело ответа
  - [ ] Сравнение с ожидаемым результатом
- [ ] Альтернативные сценарии протестированы
- [ ] Edge cases проверены (пустые значения, макс. длина, специальные символы)

### Фиксация результата
- [ ] При успехе: обновлён `status` TC в TMS
- [ ] При дефекте: создан BUG-XXXX с полной информацией
- [ ] Проблемы спецификации: эскалация SA

---

## Дефект-репорт для API

```markdown
## BUG-XXXX: POST /api/v2/resource возвращает 500 при валидном теле

**Узел**: API / v2 / resource / POST / Создание  
**Уровень**: lv7  
**Теги**: `#api` `#v2` `#SC` `#resource`  
**API версия**: v2  
**Severity**: Critical  
**Priority**: High  
**Связанный TC**: TC-XXXX

### Фактическое поведение
- HTTP 500 Internal Server Error
- Тело: `{ "message": "internal server error" }`
- В логах: `Database connection timeout`

### Ожидаемое поведение
← Ссылка на TC-XXXX или spec.md

### Шаги воспроизведения
1. Отправить POST /api/v2/{owner}/{repo}/resource с валидным телом
2. Дождаться ответа

**curl-команда:**
```bash
curl -X POST 'https://portal.works.prod.sbt/api/v2/owner/repo/resource' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name": "test"}'
```

### Окружение
- Версия: v2.0.0
- Интерфейс: API v2
- Дата: YYYY-MM-DD

### Дополнительно
- Логи сервера: ...
- База данных: ...
```

---

## Принципы API тестирования

- **Контракт — закон.** Каждый тест проверяет соответствие OpenAPI-спецификации
- **Версия API обязательна.** TC для v1 и v2 — разные файлы
- **Код ответа — часть контракта.** 2xx + все 4xx + 5xx должны быть протестированы
- **Body-валидация.** Проверять не только структуру, но и конкретные значения
- **Заголовки важны.** Location, Content-Type, ETag — проверять при необходимости
- **Связь с TC обязательна.** Каждый баг привязан к TC-XXXX

---

## Чего избегать

- ❌ Не тестировать только happy path — обязательны 4xx и edge cases
- ❌ Не смешивать v1 и v2 в одном TC
- ❌ Не писать TC без привязки к узлу test-model (node + lv)
- ❌ Не игнорировать аутентификацию в заголовках
- ❌ Не проверять только JSON-структуру — проверять значения полей
- ❌ Не тестировать deprecated-эндпоинты без согласования

---

## Полезные шаблоны запросов

### POST /api/v2/{owner}/{repo}/branches (создание)
```bash
curl -X POST 'https://portal.works.prod.sbt/api/v2/{owner}/{repo}/branches' \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "feature/test-branch",
    "ref": "refs/heads/main"
  }'
```

### GET /api/v2/{owner}/{repo}/branches (список)
```bash
curl -X GET 'https://portal.works.prod.sbt/api/v2/{owner}/{repo}/branches' \
  -H 'Authorization: Bearer <access-token>'
```

### PUT /api/v2/resource/{id} (обновление)
```bash
curl -X PUT 'https://portal.works.prod.sbt/api/v2/resource/{id}' \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{"field": "new-value"}'
```

### DELETE /api/v2/resource/{id} (удаление)
```bash
curl -X DELETE 'https://portal.works.prod.sbt/api/v2/resource/{id}' \
  -H 'Authorization: Bearer <access-token>'
```

---

## Интеграция с test-model

```
SA: spec.md (AC-123) → эндпоинт POST /api/v2/resource
         ↓
QA: TC-XXXX с node: API / v2 / resource / POST / Создание
         ↓
База: OpenAPI v2.yaml (paths./api/v2/{owner}/{repo}/resource.post)
```

Каждый AC из spec.md должен быть покрыт TC с привязкой к узлу test-model.
