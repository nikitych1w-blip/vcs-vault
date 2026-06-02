# FE · Архитектура (FSD + React)

Источник правды — код `web_src/spa` и `web_src/spa/README.md`. Проект организован по **Feature-Sliced Design (FSD)**, React + TypeScript.

## Слои FSD (сверху вниз)

```
web_src/spa/
├── app/         # инициализация: провайдеры, роутер, стили, bootstrap (App.tsx, browser-router.tsx, export-app.tsx)
├── processes/   # процессы над несколькими страницами
├── pages/       # страницы (FileView, PullCommits, OrganizationRepo, …)
├── widgets/     # композиционные блоки страниц
├── features/    # функциональности (Comments, CreateBranchModal, RefSelector, Sidemenu, …)
├── entities/    # бизнес-сущности (PullRequest, Repository, Project, User, Access, …)
└── shared/      # переиспользуемое:
    ├── api/     # API-клиенты, generated (Orval), axiosClient
    ├── lib/     # хелперы
    ├── config/  # конфиги
    ├── ui/      # базовые UI-компоненты
    ├── icons/   assets/   types/
```

## Правило зависимостей (ключевое для FSD)

Слой может импортировать **только нижележащие**: `app → processes → pages → widgets → features → entities → shared`. Снизу вверх — запрещено. Между срезами одного слоя — без прямых импортов (через `shared` или вышестоящий слой).

Проверка автоматическая:
```bash
npm run lint:fsd      # steiger ./web_src/spa
```

## Срез и сегменты

Внутри слоя — **срезы** (по доменной области, напр. `features/Comments`), внутри среза — сегменты `ui/`, `model/`, `api/`, `lib/`. Публичный API среза — через `index.ts` (баррель), наружу торчит только он.

## React-конвенции

- Функциональные компоненты + хуки; данные — через React Query (см. [[data-state]]), не самописный fetch.
- Импорты сортируются (`eslint-plugin-simple-import-sort`); типы строгие (`tsc --noEmit` через `npm run lint:types`).
- Стили — CSS + Stylelint (`web_src/spa/**/*.css`), `clsx` для классов.

## Чего избегать

- Нарушать направление зависимостей FSD (ловит `steiger`).
- Импортировать из чужого среза напрямую, минуя `index.ts`.
- Писать API-вызовы руками вместо сгенерированных хуков ([[api-client]]).
- Складывать бизнес-логику в `shared` (там только переиспользуемое без привязки к домену).

Связано: [[role]], [[api-client]], [[components]], [[mfe]].
