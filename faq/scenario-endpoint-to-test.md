---
tags: [faq, scenario, sa, qa, api, e2e]
---

# Сценарий: от спеки эндпоинта до автотестов

Описывает полный цикл — от появления нового API-эндпоинта до его покрытия в тест-модели и автотестах.

**Участники**: SA · QA · QAA  
**Затрагивает**: `vault/specs/` · `vault/test-model/` · `sources/vcs-api/` · `sources/vcs-playwright/`

---

## Фаза 1 — SA: спека эндпоинта

### 1.1 Создать файл спецификации

Путь: `vault/specs/<NNN>-<slug>/spec.md`

```markdown
---
feature_id: "NNN"
status: draft          # draft → review → approved
priority: P1
release: "X.Y"

node_path: "<путь в test-model>"
lv: <уровень>
tags: [SC, api, vN, ПАО]
pao: true
coverage_status: missing
---

# Spec: <Название фичи>

## Контекст
<Зачем нужен эндпоинт, бизнес-цель>

## User Stories
### US-NNN: <название> (P1 · #ПАО)
**AC-NNN.1** — <happy path>
\`\`\`
Given: ...
 When: ...
 Then: ...
\`\`\`
**AC-NNN.2** — <ошибочный сценарий>
\`\`\`
Given: ...
 When: ...
 Then: API возвращает <код> + body: { "message": "..." }
\`\`\`
```

### 1.2 Описать API-контракт в спеке

Включить в `spec.md` раздел по формату из `skills/sa/role.md`:

```markdown
## API-контракт

### POST /api/v2/<resource>

**Аутентификация**: access-token

#### Параметры запроса
| Параметр | Тип | Обязательный | Описание |
|----------|-----|-------------|----------|
| owner    | string | да | владелец репозитория |
| repo     | string | да | имя репозитория |

#### Тело запроса
\`\`\`json
{
  "field": "value"
}
\`\`\`

#### Успешный ответ (201)
\`\`\`json
{
  "id": 1,
  "field": "value",
  "created_at": "2026-01-01T00:00:00Z"
}
\`\`\`

#### Коды ошибок
| Код | Условие |
|-----|---------|
| 400 | Невалидное тело запроса |
| 401 | Не аутентифицирован |
| 403 | Нет прав |
| 409 | Конфликт (ресурс уже существует) |
```

### 1.3 Перевести спеку в статус `review`

Обновить frontmatter `status: review`, уведомить QA и QAA для верификации.

---

## Фаза 2 — SA + QA: тест-модель

### 2.1 Добавить узлы в test-model

Путь: `vault/test-model/1. API/2. api v2/`  
(или соответствующая версия API)

Для каждого нового поведения — отдельный листовой файл `lv7/lv8`. Формат:

```markdown
#api
#v2
#ПАО
#lv7
#SC

<!-- Краткое описание проверяемого поведения -->
Успешное создание <ресурса> через POST /api/v2/<resource>

status: missing
```

### 2.2 Сверить покрытие с AC спеки

Каждый AC должен отражаться в хотя бы одном узле test-model. Если узла нет — добавить.  
Пометить `status: missing` на всех новых узлах.

### 2.3 Согласовать с SA

- Все узлы с `#ПАО` добавлены?
- Альтернативные сценарии (4xx, edge cases) отражены?
- `node_path` в спеке указывает на корректный узел?

---

## Фаза 3 — SA: наполнение vcs-api

### 3.1 Написать OpenAPI-спецификацию

В репозитории `sources/vcs-api/` добавить или обновить файл спецификации:

```yaml
# openapi: 3.1.0 (соблюдать существующую структуру файлов репозитория)

paths:
  /api/v2/{owner}/{repo}/resource:
    post:
      summary: Создать ресурс
      operationId: createResource
      tags: [resource]
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
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateResourceRequest'
      responses:
        '201':
          description: Ресурс создан
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Resource'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          $ref: '#/components/responses/Conflict'
```

### 3.2 Обновить sources/vcs-api локально

```bash
make pull SOURCES=05-vcs-api
```

Добавить изменения через PR в vcs-api, затем обновить в vault после мёржа.

---

## Фаза 4 — QA: тест-кейсы

### 4.1 Написать TC под каждый узел lv7–lv8

По формату из `skills/qa/role.md`:

```markdown
---
id: TC-XXXX
node: API / v2 / <resource> / POST / Успешное создание
lv: 7
tags: [api, v2, SC, resource]
api_version: v2
status: covered
priority: high
tms: TC-XXXX
---

## TC-XXXX: POST /api/v2/resource — успешное создание

**Узел**: `API / v2 / <resource> / POST / Успешное создание` (lv7)

### Предусловия
- Пользователь аутентифицирован (access-token)
- Репозиторий существует

### Шаги
1. Отправить POST /api/v2/{owner}/{repo}/resource
2. Тело: `{ "field": "value" }`

### Ожидаемый результат
- HTTP 201
- Тело ответа содержит `id`, `field`, `created_at`
- Ресурс доступен через GET /api/v2/{owner}/{repo}/resource/{id}
```

### 4.2 Обновить статусы узлов

После создания TC обновить `status: covered` в соответствующих узлах test-model.

### 4.3 Верифицировать AC спеки

Сопоставить TC с AC из `vault/specs/NNN-*/spec.md`. Если AC не покрыт — открыть задачу.

---

## Фаза 5 — QAA: автотесты в vcs-playwright

### 5.1 Структура файла теста

В репозитории `sources/vcs-playwright/` создать файл по соглашению проекта:

```typescript
// tests/api/v2/resource.spec.ts

import { test, expect } from '@playwright/test';
import { ApiClient } from '../../helpers/api-client';

// TC-XXXX: POST /api/v2/resource — успешное создание
// node: API / v2 / resource / POST / Успешное создание
test.describe('POST /api/v2/{owner}/{repo}/resource', () => {
  let client: ApiClient;

  test.beforeEach(async ({ request }) => {
    client = new ApiClient(request);
  });

  test('TC-XXXX: создаёт ресурс, возвращает 201', async () => {
    const response = await client.post('/api/v2/owner/repo/resource', {
      field: 'value',
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ field: 'value' });
    expect(body.id).toBeDefined();
    expect(body.created_at).toBeDefined();
  });

  test('TC-XXXX: 400 при невалидном теле запроса', async () => {
    const response = await client.post('/api/v2/owner/repo/resource', {});

    expect(response.status()).toBe(400);
  });

  test('TC-XXXX: 403 без прав на репозиторий', async () => {
    const response = await client.postAs('readonly-user',
      '/api/v2/owner/repo/resource', { field: 'value' });

    expect(response.status()).toBe(403);
  });

  test('TC-XXXX: 409 при дублирующем запросе', async () => {
    await client.post('/api/v2/owner/repo/resource', { field: 'value' });
    const response = await client.post('/api/v2/owner/repo/resource', { field: 'value' });

    expect(response.status()).toBe(409);
  });
});
```

### 5.2 Привязка к TC и узлу

Каждый `test()` содержит в названии ID тест-кейса (`TC-XXXX`).  
В комментарии над `test.describe` — `node:` из test-model.  
Это обеспечивает трассируемость: узел → TC → автотест.

### 5.3 Обновить sources/vcs-playwright локально

После мёржа PR в vcs-playwright:

```bash
make pull SOURCES=03-vcs-playwright
```

---

## Связи между артефактами

```
vault/specs/NNN-*/spec.md          ← SA: бизнес-логика + AC
        ↓
vault/test-model/.../lv7.md        ← SA + QA: узлы модели (status: missing → covered)
        ↓
sources/vcs-api/openapi.yaml       ← SA: контракт эндпоинта
        ↓
TC в TMS (по формату qa/role.md)   ← QA: тест-кейсы (id: TC-XXXX)
        ↓
sources/vcs-playwright/tests/      ← QAA: автотесты (привязаны к TC-XXXX)
```

---

## Чеклист готовности

**SA:**
- [ ] `vault/specs/NNN-*/spec.md` создана, status: `approved`
- [ ] API-контракт описан: метод, параметры, тело, 2xx + все 4xx
- [ ] Узлы lv7–lv8 добавлены в test-model
- [ ] OpenAPI YAML добавлен / обновлён в vcs-api

**QA:**
- [ ] Каждый AC покрыт TC
- [ ] TC написаны по формату (id, node, lv, tags)
- [ ] Узлы test-model переведены в `status: covered`
- [ ] Все `#ПАО`-узлы покрыты до релиза

**QAA:**
- [ ] Автотест создан для каждого TC
- [ ] В названии теста — ID TC
- [ ] Покрыты: happy path + 4xx ошибки + edge cases
- [ ] Тесты проходят в CI
