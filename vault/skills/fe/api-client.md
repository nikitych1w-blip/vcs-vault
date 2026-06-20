# FE · API-клиент (Orval + React Query)

Скилл-выжимка. Полная заметка — `../../knowledges/fe/codegen.md` (+ `stack.md`). Источник правды по контракту — `vcs-api` (UI-surface), OpenAPI 3.0.3.

## Workflow кодогенерации

```bash
npm run api:lint       # redocly lint спеки
npm run api:bundle     # сборка → openapi_ui_bundle.yaml (руками не править)
npm run api:build      # lint + bundle
npm run api:generate   # Orval → web_src/spa/shared/api/generated/{methods,models}
npm run ts:lint        # tsc — проверить, что изменения API не сломали код
```

## Что генерится

- `generated/methods/<tag>.ts` — **React Query хуки** (имя из `operationId`: `listEntities` → `useListEntities`).
- `generated/models/*.ts` — типы (имя из имени OpenAPI-схемы; enum → union).
- HTTP — кастомный `customInstance` (`shared/api/axiosClient.ts`).

## Правила

- **`generated/` и `openapi_ui_bundle.yaml` руками НЕ править** — перегенерируются.
- В компонентах использовать **сгенерированные хуки** (`useGet…`, `use…Mutation`), не «сырой» `useQuery`.
- Изменения контракта согласовывать с аналитикой и BE; новый домен — отдельная папка в `domains/`.
- Для типов бизнес-сущностей — Utility Types (`Partial`/`Omit`/`Pick`/`Required`).

Связано: [[architecture]], [[create-page]], [[role]]. Контракт — общий с BE (vault/skills/be/submodule.md).
