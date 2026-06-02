# Как создать новую страницу на React

## Обзор

Новые страницы создаются по принципу **Feature-Sliced Design (FSD)** с использованием генерированных Orval хуков для API-запросов.

---

## Шаги создания

### 1. Добавить путь в `shared/config/router.ts`

```typescript
export const pathKeys = {
  // ...
  repository: {
    // ...
    newPage: '/:orgName/:repoName/new-page', // описание вкладки
  },
};
```

### 2. Создать структуру страницы

```bash
mkdir -p web_src/spa/pages/NewPage/{config,ui,lib,model}
touch web_src/spa/pages/NewPage/index.ts
touch web_src/spa/pages/NewPage/config/route.tsx
touch web_src/spa/pages/NewPage/ui/NewPagePage.tsx
touch web_src/spa/pages/NewPage/ui/NewPagePage.module.css
```

**Структура:**
```
pages/NewPage/
├── index.ts          # экспорт роута
├── config/
│   └── route.tsx     # определение роута
├── ui/
│   ├── NewPagePage.tsx       # главный компонент
│   └── NewPagePage.module.css
├── lib/              # логика (хелперы, хуки)
└── model/            # типы и модели (если нужно)
```

### 3. Создать `config/route.tsx`

```typescript
import { RouteObject } from 'react-router-dom';
import { pathKeys } from '~shared/config';

export const newPageRoute: RouteObject = {
  path: pathKeys.repository.newPage,
  lazy: async () => {
    const Component = await import('../ui/NewPagePage').then((module) => module.default);
    return { Component };
  },
};
```

### 4. Создать компонент страницы (`ui/NewPagePage.tsx`)

```typescript
import { useCustomParams, useQueryParams } from '~shared/lib';
import { Spinner } from '@sds-eng/base';
import { PageError } from '~shared/ui';
import { useGetRepoBranches } from '~shared/api/generated/methods/branches';

const NewPagePage = () => {
  const { orgName = '', repoName = '' } = useCustomParams();

  const { getParam, setParams } = useQueryParams();
  const page = Number(getParam('page')) || 1;

  const { data, isLoading, isError } = useGetRepoBranches(
    orgName,
    repoName,
    { limit: '10', page: String(page) },
    {
      query: {
        queryKey: ['branches', orgName, repoName, page],
      },
    },
  );

  if (isLoading) return <Spinner />;
  if (isError || !data) return <PageError type="SERVER_ERROR" />;

  return (
    <div className={styles.wrapper}>
      {/* Контент страницы */}
    </div>
  );
};

export default NewPagePage;
```

### 5. Зарегистрировать роут в `app/browser-router.tsx`

```typescript
import { newPageRoute } from '~pages/NewPage';

// В нужном layout-контейнере:
{
  lazy: RepoLayout, // или OrganizationLayout / PullLayout
  children: [
    // ... существующие роуты
    newPageRoute, // добавь новый роут
  ],
}
```

---

## Важные моменты

### Используемые хуки
- **Не используются** напрямую `useQuery`/`useMutation` из TanStack Query
- **Используются** генерированные Orval хуки:
  - `useGetRepoBranches` — GET запросы
  - `useCreateRepoBranch` — POST запросы
  - `useUpdateRepoBranch` — PUT запросы
  - `useDeleteRepoBranch` — DELETE запросы

### Состояния компонента
- **Loading:** `Spinner` из `@sds-eng/base`
- **Error:** `PageError type="SERVER_ERROR"`
- **Empty:** `PageError type="EMPTY"`
- **Данные:** отрисовка контента

---

## Работа с параметрами URL

### Path-параметры (из пути URL)

**Используется `useCustomParams()`** из `~shared/lib`:

```typescript
import { useCustomParams } from '~shared/lib';

const { orgName = '', repoName = '' } = useCustomParams();
```

**Параметры:**
- `orgName` — имя организации
- `repoName` — имя репозитория
- `branchName` — имя ветки (автоматически декодируется)
- `tagName` — имя тега (автоматически декодируется)
- `filePath` — путь к файлу (автоматически декодируется)
- `prIndex` — номер pull request

**Важно:** Всегда задавать **дефолтные значения** при деструктуризации, чтобы избежать ошибок при `undefined`:
```typescript
// ✅ Правильно
const { orgName = '', repoName = '' } = useCustomParams();

// ❌ Неправильно
const { orgName, repoName } = useCustomParams();
```

### Query-параметры (из строки запроса)

**Используется `useQueryParams()`** из `~shared/lib`:

```typescript
import { useQueryParams } from '~shared/lib';

const { getParam, setParams, setParam } = useQueryParams();

const page = Number(getParam('page')) || 1;  // ?page=2 → 2
setParams({ page: '2', sort: 'name' });       // изменить параметры
setParam('search', 'react');                  // установить один параметр
```

**Методы:**
- `getParam(key)` — получить значение параметра
- `setParams(params)` — установить несколько параметров
- `setParam(key, value)` — установить один параметр
- `removeParams(keys)` — удалить параметры
- `getAllParams()` — получить все параметры как объект

---

## Примеры из проекта

### RepoBranchesPage
```typescript
import { useCustomParams, useQueryParams } from '~shared/lib';
import { useGetRepoBranches } from '~shared/api/generated/methods/branches';

const RepoBranchesPage = () => {
  const { orgName = '', repoName = '' } = useCustomParams();
  const { getParam, setParams } = useQueryParams();

  const page = Number(getParam('page')) || 1;
  const searchBranch = getParam('q') ?? '';

  const { data, isLoading, isError } = useGetRepoBranches(
    orgName,
    repoName,
    { limit: '10', page: String(page), sort, q: searchBranch },
    {
      query: {
        queryKey: queryKeys.repo.branches(orgName, repoName, page, sort, searchBranch),
      },
    },
  );

  // обработка состояний
};
```

### RepoCodePage
```typescript
import { useCustomParams } from '~shared/lib';
import { useGetRepoFiles } from '~shared/api/generated/methods/files';

const RepoCodePage = () => {
  const { orgName = '', repoName = '' } = useCustomParams();

  const { data } = useGetRepoFiles(
    orgName,
    repoName,
    { ref: branchName },
    { query: { queryKey: [...] } },
  );

  // рендер списка файлов
};
```
