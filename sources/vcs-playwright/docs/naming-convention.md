# Naming Convention

## Общие принципы

Для обеспечения единообразия и читаемости кода в проекте применяются следующие правила именования:

1. **Использование kebab-case** для имен файлов
2. **Согласованное использование суффиксов** для различных типов файлов
3. **Структурированная организация** по функциональным модулям и категориям

## Структура файлов

### API сервисы

Файлы API сервисов находятся в директории `src/api/` и организованы по версиям и ресурсам:

```
src/api/
├── v1/
│   ├── users/
│   │   └── users.api.ts
│   └── repos/
│       └── repos.api.ts
├── v2/
│   ├── projects/
│   │   └── projects.api.ts
│   └── repos.api.ts
└── v3/
    ├── projects/
    │   └── privileges.api.ts
    └── repos/
        └── branches.api.ts
```

**Именование файлов**: `{resource}.api.ts`

- Примеры: `users.api.ts`, `privileges.api.ts`, `branches.api.ts`

### UI компоненты

Компоненты пользовательского интерфейса находятся в директории `src/ui/components/`:

```
src/ui/components/
├── base.component.ts
├── list.component.ts
├── navbar.component.ts
└── sidemenu/
    ├── body.component.ts
    ├── footer.component.ts
    ├── header.component.ts
    ├── item.component.ts
    ├── mode.component.ts
    └── sidemenu.component.ts
```

**Именование файлов**: `{component-name}.component.ts`

- Примеры: `navbar.component.ts`, `sidemenu.component.ts`

### UI страницы

Файлы страниц интерфейса находятся в директории `src/ui/pages/`:

```
src/ui/pages/
├── base.page.ts
├── dashboard.page.ts
└── project/
│   └── profile.page.ts
└── repo/
    └── settings.page.ts
```

**Именование файлов**: `{page-name}.page.ts`

- Примеры: `dashboard.page.ts`, `profile.page.ts`, `settings.page.ts`

### Сервисы

Файлы сервисов находятся в директории `src/services/`:

```
src/services/
├── api.service.ts
├── auth.service.ts
├── data.service.ts
├── file.service.ts
└── git.service.ts
```

**Именование файлов**: `{service-name}.service.ts`

- Примеры: `api.service.ts`, `auth.service.ts`, `file.service.ts`

### Утилиты

Файлы утилит находятся в директории `src/utils/`:

```
src/utils/
├── dom.util.ts
├── file.util.ts
├── object.util.ts
├── string.util.ts
└── url.util.ts
```

**Именование файлов**: `{util-name}.util.ts`

- Примеры: `string.util.ts`, `file.util.ts`, `url.util.ts`

### Типы данных

Файлы типов данных находятся в директории `src/types/`:

```
src/types/
├── annotation.type.ts
├── config.type.ts
├── user.type.ts
└── api/
    ├── assert.type.ts
    └── header.type.ts
```

**Именование файлов**: `{type-name}.type.ts`

- Примеры: `user.type.ts`, `config.type.ts`, `assert.type.ts`

### Конфигурационные файлы

Конфигурационные файлы находятся в директории `src/config/`:

```
src/config/
├── index.ts
└── loader.ts
```

**Именование файлов**: `{config-name}.ts`

- Примеры: `index.ts`, `loader.ts`

## Правила именования классов и функций

### Классы

- Используется **PascalCase**
- Названия классов отражают их функциональность
- Примеры: `UserService`, `ApiService`, `BaseComponent`

### Функции

- Используется **camelCase**
- Названия функций описывают выполняемые действия
- Примеры: `getUserData()`, `validateEmail()`, `formatDate()`

### Переменные

- Используется **camelCase**
- Названия переменных должны быть понятными и краткими
- Примеры: `userData`, `apiEndpoint`, `isAuthenticated`

### Константы

- Используется **UPPER_SNAKE_CASE**
- Названия констант отражают их значение или назначение
- Примеры: `API_BASE_URL`, `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT`

## Рекомендации по именованию

1. **Согласованность**: Все файлы внутри одного типа должны следовать одному паттерну именования
2. **Читаемость**: Имена должны быть понятными и отражать назначение файла или элемента
3. **Конкретность**: Избегайте общих названий вроде `utils.ts` или `helpers.ts`
4. **Согласованность между уровнями**: Если в одном модуле используется `resource.api.ts`, то и в других модулях следует использовать такой же паттерн
5. **Использование суффиксов**: Всегда используйте соответствующие суффиксы для различения типов файлов

## Примеры хороших имен

### Хорошие имена:

- `user.service.ts`
- `auth.interceptor.ts`
- `dashboard.page.ts`
- `UserProfileComponent`
- `getUserId()`
- `API_BASE_URL`

### Плохие имена:

- `utils.ts`
- `helpers.ts`
- `main.js`
- `data.js`
- `func1()`
- `var1`

Эти правила помогают поддерживать высокое качество кода и облегчают работу с проектом для всех разработчиков.
