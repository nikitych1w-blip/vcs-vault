# Документация по использованию API через Axios

## Обзор

Данный проект предоставляет обертку для работы с REST API с использованием библиотеки `axios`. Класс `BackApi` позволяют легко выполнять HTTP-запросы к API с поддержкой аутентификации и обработки ошибок. В качестве примера будет рассмотрен его наследник `ProjectsBackApi`.

(!) Поля в DTO и query_params записываются в snake_case. Остальные параметры объектов, которые используются в коде (не выступают в качестве DTO), должны соответствовать соглашениям.

---

## Структура проекта

### 1. `ClientOptions`

Определяет параметры конфигурации клиента:

| Поле       | Тип      | Описание                                  |
| ---------- | -------- | ----------------------------------------- |
| `baseUrl`  | `string` | Базовый URL API                           |
| `path?`    | `string` | Дополнительный путь (например, `/api/v2`) |
| `timeout?` | `number` | Таймаут запроса в миллисекундах           |
| `auth?`    | `Auth`   | Информация об авторизации                 |

---

### 2. `Auth`

Информация о пользователе или токене для авторизации:

| Поле     | Тип     | Описание                                      |
| -------- | ------- | --------------------------------------------- |
| `user?`  | `User`  | Данные пользователя для Basic Auth            |
| `token?` | `Token` | Токен для Bearer или другого типа авторизации |

#### `Token`

| Поле    | Тип                   | Описание        |
| ------- | --------------------- | --------------- |
| `value` | `string`              | Значение токена |
| `type`  | `'Bearer' \| 'token'` | Тип токена      |

---

### 3. `BackApi`

Наследник `ApiWrapper`, добавляющий поддержку авторизации.

#### Конструктор

```ts
constructor({ baseUrl, path, auth, timeout }: ClientOptions)
```

Инициализирует клиент и применяет настройки авторизации.

#### Метод `configure`

```ts
private configure(auth?: Auth)
```

Настройка заголовков и аутентификации:

- Если передан `token`, устанавливается заголовок `Authorization`.
- Если передан `user`, используется Basic Auth.

---

### 4. `isStatus`

Функция для проверки статуса ответа:

```ts
const isStatus =
  (expected: number) =>
  (status: number): boolean =>
    status === expected;
```

Используется для валидации статуса ответа в методах `axios`.

---

## Пример использования

### Создание клиента проектов

```ts
export class ProjectsBackApi extends BackApi {
  constructor({ baseUrl, timeout, auth }: ClientOptions) {
    super({
      path: 'api/v2/projects',
      baseUrl: baseUrl,
      timeout: timeout,
      auth: auth,
    });
  }

  getProject(options: ProjectOptions): Promise<ProjectInfo> {
    return step(`Получение проекта по ключу ${options.projectKey}`, async () => {
      const response = await this.get('', {
        params: options,
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  createProject(options: CreateProjectOptions): Promise<ProjectInfo> {
    return step(`Создание проекта ${options.name}`, async () => {
      const response = await this.post('create', options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }
}
```

## Примеры вызовов

### Получение проекта

```ts
const projectApi = new ProjectsBackApi({
  baseUrl: config.api.baseUrl,
  auth: {
    token: { value: 'abc123', type: 'token' },
  },
});

const project = await projectApi.getProject({
  project_key: 'PROJ-123',
  tenant_key: 'TENANT-456',
});
```

### Создание проекта

```ts
const newProject = await projectApi.createProject({
  project_key: 'NEW-789',
  tenant_key: 'TENANT-456',
  description: 'Новый проект',
  name: 'Новый проект',
  visibility: Visibility.PRIVATE,
});
```

---

## Авторизация

Поддерживаются следующие типы авторизации:

- **PAT**:

  ```ts
  auth: {
    token: { value: 'token_value', type: 'token' }
  }
  ```

- **Bearer Token**:

  ```ts
  auth: {
    token: { value: 'token_value', type: 'Bearer' }
  }
  ```

- **Basic Auth**:

  ```ts
  auth: {
    user: { name: 'username', password: 'password' }
  }
  ```

---

## Настройки

### Таймаут

Глобально для всего проекта задается в конфигурации: `api.timeout`.

Установка времени ожидания запроса для конкретного экземпляра API:

```ts
new ProjectsBackApi({
  baseUrl: config.api.baseUrl,
  timeout: 5000, // 5 секунд
});
```

---

## Валидация статуса

Все методы используют функцию `validateStatus` для проверки успешности ответа:

```ts
validateStatus: isStatus(200); // только статус 200 считается успешным
```

---

## Зависимости

- [axios](https://axios-http.com/ru/docs/intro)
