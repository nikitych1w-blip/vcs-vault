# Архитектура Frontend-приложения

## Методология

Проект организован по методологии **Feature-Sliced Design (FSD)**.

## Структура слоёв

```
web_src/spa/
├── app/          # Инициализация приложения, провайдеры, роутинг
├── entities/     # Бизнес-сущности (данные и логика)
├── features/     # Функциональности (целевые пользовательские сценарии)
├── pages/        # Страницы приложения
├── widgets/      # Композиционные блоки страниц (находится рядом в gitea)
└── shared/       # Переиспользуемый код
```

## Описание слоёв

### `app/` — Инициализация приложения

**Файлы:**
- `App.tsx` — Корневой компонент с провайдерами (Theme, Query, Router)
- `bootstrap.tsx` — Точка входа (рендер приложения)
- `browser-router.tsx` — Конфигурация React Router

**Провайдеры:**
- `QueryProvider` — React Query Client
- `ThemeProvider` + `DateLibAdapterProvider` — @sds-eng/base

### `entities/` — Бизнес-сущности

Содержит типы, API-клиенты и логику для бизнес-сущностей:

- `Access/` — Доступ и привилегии
- `CodeScanner/` — Сканер кода
- `Configuration/` — Конфигурация
- `File/` — Файлы
- `Project/` — Проекты
- `PullRequest/` — Pull Request
- `Repository/` — Репозитории
- `User/` — Пользователи

### `features/` — Функциональности

Функциональные блоки, реализующие пользовательские сценарии:

- `Comments/` — Комментарии
- `CreateBranchModal/` — Модальное окно создания ветки
- `CreateNewPullRequest/` — Создание PR
- `CreateTagModal/` — Модальное окно создания тега
- `DiffInteractive/` — Интерактивный diff
- `RefSelector/` — Выбор ветки/тега
- `Sidemenu/` — Боковое меню
- `SWWidget/` — Widget для светлой/тёмной темы

### `pages/` — Страницы

Компоненты страниц (по одной на route):

- `OrganizationRepo/` — Репозитории организации
- `PullCommits/` — Коммиты PR
- `RepoBranches/` — Ветки репозитория
- `RepoCode/` — Код репозитория
- `RepoPullsCreate/` — Создание PR
- И другие...

### `shared/` — Общий код

#### `shared/api/`
- `axiosClient.ts` — Настраиваемый axios с `baseURL` из `window.__CONTEXT_API_PATH__`
- `queryClient.ts` — React Query Client (staleTime: 60s, retry: false)
- `generated/` — Сгенерированные Orval хуки и типы

#### `shared/lib/`
Вспомогательные функции:
- `basename.ts`, `capitalize.ts`, `formatDate.ts`, `formatBytes.ts`
- `useClickStreamEvent.ts`, `useToggleTheme.ts` — кастомные хуки
- `isDirtyModel.ts`, `validateBranchName.ts` — валидация

#### `shared/config/`
- `router.ts` — `pathKeys` — константы маршрутов
- `index.ts` — экспорт конфигурации

#### `shared/ui/`
 переиспользуемые UI-компоненты:
- `ButtonDropdown`, `CodeEditor`, `CommitsDataGrid`
- `DiffCore`, `RichTextEditor`, `SearchField`
- `TableWrapper`, `Time`, `AvatarLink` и др.

#### `shared/assets/`
Статические файлы (шрифты, картинки)

#### `shared/icons/`
SVG-иконки

#### `shared/types/`
Общие TypeScript-типы

## Работа с API

```
API путь: /apifront/web/v2
Источник: window.__CONTEXT_API_PATH__
```

**Используемые технологии:**
- **Orval** — генерация типов и хуков из OpenAPI
- **React Query** — кэширование данных
- **Axios** — HTTP-клиент с перехватчиками

**Настройки React Query:**
- `staleTime`: 60_000 (1 минута)
- `retry`: false (для запросов и мутаций)
- `refetchOnWindowFocus`: false
- `refetchOnReconnect`: true

## Роутинг

**React Router v6** с `createBrowserRouter`.

**Режим MFE:**
- При работе как микрозапроса basename берётся из `window.__CONTEXT_PATH__`
- При переходе на неизвестный роут происходит перезагрузка страницы (Fallback на старый UI)

**Ключевые роуты:**
- `/org/:orgName` — репозитории организации
- `/:orgName/:repoName` — код репозитория
- `/:orgName/:repoName/pulls/create` — создание PR
- `/:orgName/:repoName/branches` — ветки

## Стилизация

- **@sds-eng/base** — корпоративный UI-кит (темы, компоненты)
- **CSS Modules** — локальная изоляция стилей компонентов

## Составляющие FSD-слоёв (дополнительно)

В соответствии с FSD могут быть добавлены:
- `processes/` — процессы (настоящие не используются, но зарезервированы)
- `widgets/` — композиционные блоки (например, MainLayout, RepoLayout)
