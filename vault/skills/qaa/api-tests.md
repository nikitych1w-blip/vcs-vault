# QAA · API / Kafka тесты

Скилл-выжимка. Заметки — `<vcs-playwright>/docs/api.md`. Тесты — `tests/src/api`, схемы — `tests/resources/schemas`.

## API-клиент (паттерн)

Базовый `ApiWrapper` → `BackApi` (axios + авторизация). На ресурс — наследник, напр. `ProjectsBackApi` (`src/api/<v>/<resource>/<resource>.api.ts`).

```ts
export class ProjectsBackApi extends BackApi {
  constructor({ baseUrl, timeout, auth }: ClientOptions) {
    super({ path: 'api/v2/projects', baseUrl, timeout, auth });
  }
  getProject(o: ProjectOptions): Promise<ProjectInfo> {
    return step(`Получение проекта ${o.projectKey}`, async () => {
      const r = await this.get('', { params: o, validateStatus: isStatus(HttpStatusCode.Ok) });
      return r.data;
    });
  }
}
```

- **`isStatus(code)`** — валидатор статуса (`validateStatus: isStatus(201)` — успехом считается только ожидаемый код).
- Каждый метод — в **`step('...')`** (информативный Allure).
- **DTO и query_params — `snake_case`** (как в API). Остальной код — camelCase/PascalCase ([[conventions]]).

## Авторизация

`auth: { token: { value, type: 'token' } }` (PAT) · `type: 'Bearer'` · `{ user: { name, password } }` (Basic). Секреты — из Vault ([[setup-run]]).

## Валидация ответа

- Типы — zod из `src/api/generated/types` ([[codegen]]).
- Доп. структура — **ajv** + JSON-схемы из `tests/resources/schemas`.
- Покрывать коды: 2xx + 4xx (400/401/403/404/409) + 5xx — по `qa/test-plan.md` и контракту.

## Kafka / интеграции

События — по сгенерированным Kafka-схемам (`generate:zod`, продьюсеры v1/v2/elk). Проверки БД — через `pg`-сервис. Тестовые данные — `tests/resources/testdata`, faker.

## Трассируемость

В тесте — связь с **TC** (`TC-XXXX`) и **узлом** test-model (комментарий/тег), как Фаза 5 сценария.

Связано: [[codegen]], [[conventions]], [[setup-run]], [[role]].
