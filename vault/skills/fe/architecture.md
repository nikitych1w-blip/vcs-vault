# FE · Архитектура (FSD + React)

Скилл-выжимка. Полная заметка — `../../knowledges/fe/architecture.md` (+ `stack.md`).

## Стек (web2)

React 18.3 + TypeScript, React Router 6, **Rsbuild** (Rspack, Module Federation 2.0), **React Query** + **Axios**, стили — **CSS Modules** + **@sds-eng/base**. Архитектура — **Feature-Sliced Design (FSD)**.

## Слои FSD (`web_src/spa/`)

`app → pages → widgets → features → entities → shared` (зависимости только вниз; `processes/` зарезервирован).

- `app/` — `App.tsx` (провайдеры Theme/Query/Router), `bootstrap.tsx`, `browser-router.tsx`.
- `entities/` — бизнес-сущности (Repository, PullRequest, Project, User, Access…).
- `features/` — сценарии (CreateBranchModal, RefSelector, Comments…).
- `pages/` — по одной на роут.
- `shared/` — `api/` (axiosClient, queryClient, generated), `lib/` (хуки/хелперы), `config/` (`router.ts` → `pathKeys`), `ui/`, `assets/`, `icons/`, `types/`.

Публичный API среза — через `index.ts`; импорт между срезами — только через него. Проверка слоёв: `npm run lint:fsd` (steiger).

## API-слой (важные факты)

- Базовый путь: **`/apifront/web/v2`**, `baseURL` из `window.__CONTEXT_API_PATH__` (`shared/api/axiosClient.ts`).
- React Query (`shared/api/queryClient.ts`): `staleTime: 60_000`, `retry: false`, `refetchOnWindowFocus: false`, `refetchOnReconnect: true`.
- Запросы — только через сгенерированные Orval-хуки ([[api-client]]), не «сырой» `useQuery`.

## Роутинг / MFE

React Router v6 `createBrowserRouter`. В MFE-режиме basename из `window.__CONTEXT_PATH__`; неизвестный роут → перезагрузка (fallback на старый UI). Добавление роута — см. [[create-page]] (+ обязательная синхронизация с `gitea-react-adapter.js`).

## Чего избегать

- Нарушать направление зависимостей FSD (ловит steiger).
- Импорт мимо `index.ts` среза.
- Прямой `useQuery`/`useMutation` вместо сгенерированных хуков.

Связано: [[api-client]], [[create-page]], [[styleguide]], [[role]].
