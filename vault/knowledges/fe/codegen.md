# Работа с кодогенерацией (OpenAPI + Orval)

Источник: [VCS-8308](https://portal.works.prod.sbt/pages/viewpage.action?pageId=...) — Гайды

---

## Процесс разработки API

### 1. Модульная структура OpenAPI-спецификации

```
api/openapi/
└── <domain>/
    ├── routes.yaml      # HTTP-операции (GET, POST, PUT, DELETE)
    ├── params.yaml      # Параметры запроса (path, query, headers)
    ├── schemas.yaml     # Доменные схемы данных
    └── responses.yaml   # Ответы API
```

### 2. Структура `routes.yaml`

Маршруты описываются в формате OpenAPI 3.0.3:

```yaml
openapi: 3.0.3
info:
  title: Domain API
  version: 1.0.0

paths:
  /{domain}:
    get:
      operationId: listDomain
      parameters:
        - $ref: '../common/params/page.yaml'
        - $ref: '../common/params/limit.yaml'
      responses:
        '200':
          $ref: '../common/responses/success.yaml'
    post:
      operationId: createDomain
      requestBody:
        $ref: '#/components/requestBodies/DomainCreate'
      responses:
        '201':
          $ref: '../common/responses/created.yaml'
```

### 3. Структура `schemas.yaml`

Описывает доменные структуры данных. **Все схемы централизованы в `schemas.yaml`.**

**Основные схемы:**
- `Domain` — базовая схема одной сущности
- `DomainResponse` — ответ для GET по ID
- `DomainList` — список сущностей
- `DomainCreatePayload` — тело запроса для POST
- `DomainUpdatePayload` — тело запроса для PUT

**Минимальный набор полей в схеме:**
- `type` — тип данных (обычно `object`)
- `properties` — список полей
- `required` — обязательные поля
- `example` — пример значения
- `description` — пояснение
- `items` — тип элементов массива
- `$ref` — ссылка на другую схему

### 4. Общие компоненты в `/common`

Выносятся в отдельную директорию:
- `params/` — общие параметры (page, limit, sort и т.д.)
- `schemas/` — общие схемы (pagination, error response и т.д.)
- `responses/` — стандартные ответы (success, created, error)

**Важно:**
- Имена компонентов в PascalCase (`User`, `Branch`, `RepositoriesList`)
- Используйте `$ref` вместо дублирования
- Кросс-импорты между доменами нежелательны

---

## Workflow

### Шаг 1: Линтинг
```bash
npm run api:lint
```
Проверяет корректность OpenAPI-спецификации (Redocly).

### Шаг 2: Сборка бандла
```bash
npm run api:bundle
```
Собирает модули в единый файл `openapi_ui_bundle.yaml`.

**Альтернатива:**
```bash
npm run api:build  # lint + bundle в одной команде
```

### Шаг 3: Генерация кода
```bash
npm run api:generate
```
Генерирует TypeScript-код:
```
web_src/spa/shared/api/generated/
├── methods/
│   └── entities.ts
└── models/
    ├── entity.ts
    ├── entityCreatePayload.ts
    ├── entityList.ts
    ├── entityResponse.ts
    ├── entityUpdatePayload.ts
    ├── getEntitiesParams.ts
    └── index.ts
```

### Шаг 4: Проверка типов
```bash
npm run ts:lint
```
Убеждается, что изменения API не сломали существующий код.

---

## Именование

### Имена TS моделей
Определяются названием OpenAPI-схемы.

### Имена TS методов (React Query hooks)
Определяются значением `operationId` в `routes.yaml`.

**Пример:**
```yaml
operationId: listEntities
# → сгенерируется useListEntities() хук
```

---

## Рекомендации

- Все изменения в спецификации согласовывать с **аналитикой** и **бэкенд-разработчиками**
- Новые сущности добавлять в `domains/` как отдельную директорию
- После изменений запускать `lint`, `bundle` и `generate`
- Не редактировать `openapi_ui_bundle.yaml` вручную (только для чтения)
- Проверять документацию через `npm run api:preview`
- Включать бэкенд-разработчиков в ревью

---

## Utility Types

Для типизации бизнес-сущностей использовать TypeScript Utility Types:
- `Partial<T>` — сделать все поля необязательными
- `Omit<T, K>` — исключить поля
- `Pick<T, K>` — выбрать поля
- `Required<T>` — сделать все поля обязательными
