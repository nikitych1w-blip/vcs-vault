# FE · API-клиент (Orval + React Query)

API-клиент **генерируется Orval-ом** из того же UI-контракта `vcs-api`, что использует BE (источник правды). Руками клиент не пишется. Конфиг — `orval.config.cjs`.

## Что генерится (из `orval.config.cjs`)

- **Источник**: UI-бандл `vcs-api` — `api/openapi/spec_embed/spec_from_sub_module/api/openapi/ui/openapi_ui_bundle.yaml` (тот же submodule, что у BE — см. BE `submodule.md`).
- **Клиент**: `react-query` → генерируются хуки `useQuery`/`useMutation`.
- **Режим**: `mode: 'tags'` → папка на каждый OpenAPI-тег.
- **Методы** → `web_src/spa/shared/api/generated/methods`
- **Модели** → `web_src/spa/shared/api/generated/models` (enum → union-типы)
- **HTTP-клиент**: кастомный `mutator` → `shared/api/axiosClient.ts` (экспорт `customInstance`, обёртка над axios).

## Команда генерации

```bash
npm run api:generate     # api:build (bundle) + orval --config ./orval.config.cjs
npm run lint:orval       # prettier+eslint --fix по shared/api/generated
```

## Правила

- **`shared/api/generated/` руками НЕ править** — перегенерируется (`clean: true`). Это FE-аналог codegen-правила BE (`*.gen.go` не трогать).
- Новая/изменённая ручка в `vcs-api` → сначала обновить контракт (как в BE-flow), затем `npm run api:generate` → появятся хуки/типы.
- Использовать **сгенерированные хуки** (`useGet...`, `use...Mutation`) из `methods`, типы — из `models`. Не дублировать модели руками.
- Кастомную логику запросов класть в `axiosClient.ts` (интерсепторы, auth, базовый URL), а не в компоненты.

## Связь с контрактом

`operationId`/теги из UI-спеки `vcs-api` определяют имена сгенерированных хуков и структуру моделей. Расхождение поведения с `be/design.md` → эскалация к SA/BE до использования.

Связано: [[data-state]], [[role]]. Источник контракта — общий с BE (`vault/skills/be/submodule.md`).
