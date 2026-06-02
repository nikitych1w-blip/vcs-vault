# FE · Создание страницы (React, FSD)

Скилл-выжимка. Полные заметки — `../../knowledges/fe/webpage-creation.md` и `gitea-react-adapter.md`.

## Макет (вход)

Визуальный источник — **макет** (скрин/ссылка от оператора, поле «Макет» в proposal). Из него на стадии `fe-design` выдели только нужное:
- какие **компоненты** (напр. компонент поиска + список карточек репозитория);
- что **отображается** в карточке/списке (поля — из сгенерированной спеки/моделей);
- **данные** — через сгенерированные Orval-хуки ([[api-client]]), не «сырой» fetch;
- **пагинация / фильтры / сортировка** — из контракта спеки (параметры запроса).

Если в `fe/design.md` явно заданы размеры (container width/paddings/card min-height/breakpoints), их нужно соблюдать как обязательные ограничения.
Если макета нет — проектировать по требованиям + дизайн-системе, явно это отметив.

Правила соответствия:
- не добавлять UI-контролы «по предположению»: control появляется только если подтверждён в SA/FE-артефактах;
- если параметр есть в API-контракте, но не показан в макете, поддерживать его через URL/API слой без обязательного отдельного input на экране.

## Шаги

1. **Путь** в `shared/config/router.ts` → `pathKeys` (напр. `repository.newPage: '/:orgName/:repoName/new-page'`).
2. **Структура** `pages/NewPage/{config,ui,lib,model}` + `index.ts`:
   - `config/route.tsx` — `RouteObject` с `lazy` (динамический импорт компонента);
   - `ui/NewPagePage.tsx` + `.module.css` — главный компонент;
   - `lib/` — хуки/хелперы, `model/` — типы.
3. **Компонент**: параметры через `useCustomParams()` (path: `orgName`/`repoName`/`branchName`/`prIndex`…, **всегда с дефолтами** `= ''`) и `useQueryParams()` (`getParam`/`setParams`); данные — **сгенерированными Orval-хуками** ([[api-client]]).
4. **Регистрация** роута в `app/browser-router.tsx` (в нужном layout: `RepoLayout`/`OrganizationLayout`/`PullLayout`).
5. **🔴 Синхронизация с адаптером**: на новый роут добавить regex в `web_src/js/bridge/gitea-react-adapter.js` (`routeHandlers`, от частных к общим; при необходимости — `getCheckAPIUrl` для проверки существования ресурса). Без этого переход уйдёт в старый UI.

## Состояния (обязательно)

```tsx
if (isLoading) return <Spinner />;            // @sds-eng/base
if (isError || !data) return <PageError type="SERVER_ERROR" />;
// пусто → <PageError type="EMPTY" />
```

Карточки/списки с признаками доступа (`private/internal/archive/source_hub`) должны иметь визуально различимые статусы (отдельные badge/tokens), а не единый нейтральный стиль.
Подробнее — [[states-checklist]].

## Зарезервированные префиксы (всегда старый UI)

`/admin/** /user/** /org/** /notifications/** /pulls/** /repo/**` — React их не обрабатывает.

## Чего избегать

- Прямой `useQuery`/`useMutation` вместо Orval-хуков.
- Деструктуризация `useCustomParams()` без дефолтов.
- Новый роут в `browser-router` без regex в `gitea-react-adapter.js`.
- Добавление фильтра/поля в UI без подтверждения в `fe/design.md`/SA.

Связано: [[architecture]], [[api-client]], [[states-checklist]], [[role]].
